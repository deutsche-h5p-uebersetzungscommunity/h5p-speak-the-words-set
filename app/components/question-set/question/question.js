import React from 'react';
import './question.css';

/**
 * Question component.
 * Integrates with H5P's newRunnable and renders the third-party questions within itself.
 */
export default class Question extends React.Component {

  /**
   * Question.
   * Initializes question instance and listeners.
   *
   * @constructor
   * @param props
   * @param props.question Question parameters
   * @param props.slideIndex Index of the slide that this question is on
   * @param props.parent Reference to parent
   * @param props.jumpToSlide Jump to given slide number
   *
   */
  constructor(props) {
    super(props);

    this.l10n = props.parent.params.l10n;

    // Override question's autoplay for introductory medium and take over
    this.autoplayIntroMedium = this.prepareIntroMediumAutoplay(props.question.params);

    // Initializes instance of question, attached when component is mounted
    this.instance = H5P.newRunnable(props.question, props.parent.contentId, undefined, false, {
      parent: props.parent
    });
    props.parent.questionInstances.push(this.instance);

    props.parent.on('resize', () => this.instance.trigger('resize', {fromParent: true}));

    // Add navigation buttons
    this.lastIndex = props.parent.params.questions.length - 1;
    const showFinishButton = props.slideIndex === this.lastIndex;
    const showNextButton = !showFinishButton;
    const showPreviousButton = props.slideIndex !== 0;

    if (showFinishButton) {
      this.instance.addButton('finish', 'Finish', () => {
        this.props.parent.eventStore.trigger('showSolutionScreen');
      }, false);

      props.parent.eventStore.on('answeredAll', () => {
        this.instance.showButton('finish');
      });

      props.parent.eventStore.on('retrySet', () => {
        this.instance.hideButton('finish');
      });
    }

    if (showNextButton) {
      this.instance.addButton('next', '', () => {
          props.jumpToSlide(props.slideIndex + 1);
        }, true,
        {
          href: '#', // Use href since this is a navigation button
          'aria-label': this.l10n.nextQuestionAriaLabel
        });
    }

    if (showPreviousButton) {
      this.instance.addButton('previous', '', () => {
          props.jumpToSlide(props.slideIndex - 1);
        }, true,
        {
          href: '#', // Use href since this is a navigation button
          'aria-label': this.l10n.previousQuestionAriaLabel
        });
    }
  }

  /**
   * Runs whenever component is initialized.
   * Sets up listeners on instance and parent.
   */
  componentDidMount() {
    // Integrate with Question instance
    const $questionContainer = H5P.jQuery(this.el);
    this.instance.attach($questionContainer);

    // Listen for resize event and propagate them to parent
    this.instance.on('resize', (event) => {
      if(event.data === undefined || event.data.fromParent !== true) {
        this.props.parent.resizeWrapper();
      }
    });

    // Listen for user interactions on instance and enhance them
    this.instance.on('xAPI', this.enhanceXAPIEvent.bind(this));

    this.props.parent.eventStore.on('retrySet', () => {
      this.instance.resetTask();
      this.props.parent.resizeWrapper();
    });

    this.props.parent.eventStore.on('showSolutions', () => {
      this.instance.showSolutions();
      this.props.parent.resizeWrapper();
    });

    // Make progress announcer available
    this.props.parent.progressAnnouncers[this.props.slideIndex] = this.progressAnnouncer;
  }

  /**
   * Runs whenever component is updated.
   */
  componentDidUpdate() {
    this.instance.trigger('resize');
  }

  /**
   * Enhances xAPI events that are caught from question instances.
   * @param event An xAPI event
   */
  enhanceXAPIEvent(event) {
    // Mark slide as answered
    const shortVerb = event.getVerb();
    const isAnswered = ['interacted', 'answered', 'attempted'].includes(shortVerb);
    if (isAnswered) {
      this.props.parent.eventStore.trigger('slideAnswered', {slideNumber: this.props.slideIndex});
    }

    // Add slide number to xAPI data
    let context = event.data.statement.context;
    if (context.extensions === undefined) {
      context.extensions = {};
    }
    context.extensions['http://id.tincanapi.com/extension/ending-point'] = this.props.slideIndex + 1;
  }

  /**
   * Prepare autoplay behavior of introductory media.
   * @param {object} params Library/action object form params.
   * @return {boolean} True, if medium should autoplay, else false.
   */
  prepareIntroMediumAutoplay(params) {
    if (!params || !params.media || !params.media.type) {
      return false; // No medium set
    }

    const type = params.media.type;
    if (!type.params) {
      return false; // No parameters found
    }

    let shouldAutoplay = false;

    // Keep track of desired autoplay behavior and override
    const library = (type.library || '').split(' ')[0];
    if (library === 'H5P.Audio') {
      shouldAutoplay = type.params.autoplay;
      type.params.autoplay = false;
    }
    else if (library === 'H5P.Video' && type.params.playback) {
      shouldAutoplay = type.params.playback.autoplay;
      type.params.playback.autoplay = false;
    }

    return shouldAutoplay;
  }

  /**
   * Renders the component whenever properties or state changes.
   * @returns {XML}
   */
  render() {
    let classes = 'question';
    if (!this.props.showingQuestions || this.props.currentSlideIndex !== this.props.slideIndex) {
      classes += ' hidden';
    }
    else if (this.autoplayIntroMedium) {
      if (typeof this.instance.play === 'function') {
        setTimeout(() => {
          this.instance.play();
        }, 0); // H5P.Question audio sections need to be ready
      }
      this.autoplayIntroMedium = false; // Only autoplay once
    }

    return (
      // Store a reference to element and make third party lib maintain this element
      <div className={classes}>
        <div
          tabIndex='-1'
          className='progress-announcer'
          ref={el => this.progressAnnouncer = el}
        >
          {this.l10n.navigationBarTitle.replace(':num', this.props.slideIndex + 1)}
          </div>
        <div ref={el => this.el = el}/>
      </div>
    );
  }
}
