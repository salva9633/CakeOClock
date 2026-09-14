/* ============================================================
   CAKE O'CLOCK AI — GLOBAL CHATBOT
   Chat behavior + session persistence
============================================================ */

(function () {
  'use strict';

  const launcher = document.getElementById('cocChatbotLauncher');
  const chatbot = document.getElementById('cocChatbot');
  const closeButton = document.getElementById('cocChatbotClose');

  const messagesContainer =
    document.getElementById('cocChatbotMessages');

  const input =
    document.getElementById('cocChatbotInput');

  const sendButton =
    document.getElementById('cocChatbotSend');

  const typingIndicator =
    document.getElementById('cocChatbotTyping');

  const welcomeMessage =
    document.getElementById('cocChatbotWelcome');

  /*
   * Make sure the global chatbot markup exists
   * before initializing the script.
   */
  if (
    !launcher ||
    !chatbot ||
    !closeButton ||
    !messagesContainer ||
    !input ||
    !sendButton ||
    !typingIndicator
  ) {
    return;
  }


  /* ==========================================================
     STATE
  ========================================================== */

  let isOpen = false;
  let isSending = false;


  /* ==========================================================
     SCROLL
  ========================================================== */

  function scrollToBottom() {
    messagesContainer.scrollTop =
      messagesContainer.scrollHeight;
  }


  /* ==========================================================
     OPEN / CLOSE
  ========================================================== */

  function openChatbot() {
    if (isOpen) {
      input.focus();
      return;
    }

    isOpen = true;

    chatbot.classList.add('is-open');

    chatbot.setAttribute(
      'aria-hidden',
      'false'
    );

    launcher.setAttribute(
      'aria-expanded',
      'true'
    );

    /*
     * Give the opening animation a moment to start
     * before focusing the input.
     */
    setTimeout(() => {
      input.focus();
      scrollToBottom();
    }, 150);
  }


  function closeChatbot() {
    if (!isOpen) {
      return;
    }

    isOpen = false;

    chatbot.classList.remove('is-open');

    chatbot.setAttribute(
      'aria-hidden',
      'true'
    );

    launcher.setAttribute(
      'aria-expanded',
      'false'
    );

    launcher.focus();
  }

  /* ==========================================================
   SAFE MARKDOWN RENDERER
    ========================================================== */

    function renderMarkdown(container, text) {
    container.replaceChildren();

    const lines = String(text).split(/\r?\n/);

    let currentList = null;
    let currentListType = null;

    function finishList() {
        if (currentList) {
        container.appendChild(currentList);
        currentList = null;
        currentListType = null;
        }
    }

    function createInlineContent(value, parent) {
        /*
        * Split text into:
        * - links
        * - inline code
        * - bold
        * - italic
        */

        const pattern =
        /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;

        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(value)) !== null) {

        if (match.index > lastIndex) {
            parent.appendChild(
            document.createTextNode(
                value.slice(lastIndex, match.index)
            )
            );
        }

        /*
        * Markdown link
        */
        if (match[2] && match[3]) {
            const link =
            document.createElement('a');

            link.href = match[3];
            link.textContent = match[2];

            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            parent.appendChild(link);
        }

        /*
        * Inline code
        */
        else if (match[4]) {
            const code =
            document.createElement('code');

            code.textContent = match[4];

            parent.appendChild(code);
        }

        /*
        * Bold
        */
        else if (match[5] || match[6]) {
            const strong =
            document.createElement('strong');

            strong.textContent =
            match[5] || match[6];

            parent.appendChild(strong);
        }

        /*
        * Italic
        */
        else if (match[7] || match[8]) {
            const em =
            document.createElement('em');

            em.textContent =
            match[7] || match[8];

            parent.appendChild(em);
        }

        lastIndex =
            pattern.lastIndex;
        }

        /*
        * Remaining plain text.
        */
        if (lastIndex < value.length) {
        parent.appendChild(
            document.createTextNode(
            value.slice(lastIndex)
            )
        );
        }
    }


    function createParagraph(line) {
        const paragraph =
        document.createElement('p');

        createInlineContent(
        line,
        paragraph
        );

        return paragraph;
    }


    lines.forEach((line) => {

        const trimmed =
        line.trim();


        /*
        * Empty line.
        */
        if (!trimmed) {
        finishList();
        return;
        }


        /*
        * Heading
        *
        * # Heading
        * ## Heading
        * ### Heading
        */
        const headingMatch =
        trimmed.match(/^(#{1,3})\s+(.+)$/);

        if (headingMatch) {

        finishList();

        const level =
            headingMatch[1].length;

        const heading =
            document.createElement(
            `h${level}`
            );

        createInlineContent(
            headingMatch[2],
            heading
        );

        container.appendChild(
            heading
        );

        return;
        }


        /*
        * Bullet list
        *
        * - Item
        * * Item
        * + Item
        */
        const bulletMatch =
        trimmed.match(/^[-*+]\s+(.+)$/);

        if (bulletMatch) {

        if (
            currentListType !== 'ul'
        ) {
            finishList();

            currentList =
            document.createElement('ul');

            currentListType = 'ul';
        }

        const item =
            document.createElement('li');

        createInlineContent(
            bulletMatch[1],
            item
        );

        currentList.appendChild(
            item
        );

        return;
        }


        /*
        * Numbered list
        *
        * 1. Item
        * 2. Item
        */
        const numberedMatch =
        trimmed.match(/^\d+\.\s+(.+)$/);

        if (numberedMatch) {

        if (
            currentListType !== 'ol'
        ) {
            finishList();

            currentList =
            document.createElement('ol');

            currentListType = 'ol';
        }

        const item =
            document.createElement('li');

        createInlineContent(
            numberedMatch[1],
            item
        );

        currentList.appendChild(
            item
        );

        return;
        }


        /*
        * Normal paragraph.
        */
        finishList();

        container.appendChild(
        createParagraph(trimmed)
        );

    });


    finishList();
    }

  /* ==========================================================
     ADD MESSAGE
  ========================================================== */

  function addMessage(text, sender) {
    if (
      typeof text !== 'string' ||
      !text.trim()
    ) {
      return;
    }

    const message = document.createElement('div');

    message.className =
      'coc-chatbot-message ' + sender;


    /*
     * AI messages have the small avatar.
     */
    if (sender === 'ai') {
        const avatar =
            document.createElement('div');

        avatar.className =
            'coc-chatbot-mini-avatar';

        const image =
            document.createElement('img');

        image.src = '/media/coc_ai.png';
        image.alt = '';
        image.setAttribute(
            'aria-hidden',
            'true'
        );

        avatar.appendChild(image);

        message.appendChild(avatar);
        }


    const bubble =
      document.createElement('div');

    bubble.className =
      'coc-chatbot-bubble';


    renderMarkdown(bubble, text);


    message.appendChild(bubble);


    /*
     * Always insert before the typing indicator.
     */
    messagesContainer.insertBefore(
      message,
      typingIndicator
    );


    scrollToBottom();
  }


  /* ==========================================================
     LOADING STATE
  ========================================================== */

  function setLoading(loading) {
    isSending = loading;

    typingIndicator.classList.toggle(
      'show',
      loading
    );

    sendButton.disabled = loading;

    input.disabled = loading;

    if (loading) {
      scrollToBottom();
    }
  }


  /* ==========================================================
     INPUT AUTO RESIZE
  ========================================================== */

  function autoResize() {
    input.style.height = 'auto';

    input.style.height =
      Math.min(
        input.scrollHeight,
        120
      ) + 'px';
  }


  /* ==========================================================
     LOAD SAVED SESSION
  ========================================================== */

  async function loadChatSession() {
    try {
      const response =
        await fetch(
          '/api/chatbot/session',
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            credentials: 'same-origin'
          }
        );


      /*
       * If the user is not logged in, don't show
       * an error message inside the chatbot.
       *
       * The normal application authentication
       * behavior handles this.
       */
      if (response.status === 401) {
        return;
      }


      if (!response.ok) {
        throw new Error(
          'Failed to load chat session.'
        );
      }


      const data =
        await response.json();


      if (
        !data ||
        !data.success ||
        !Array.isArray(data.messages)
      ) {
        return;
      }


      /*
       * No previous conversation.
       *
       * Keep the default welcome message.
       */
      if (data.messages.length === 0) {
        return;
      }


      /*
       * A previous conversation exists.
       *
       * Remove only the static welcome message.
       */
      if (welcomeMessage) {
        welcomeMessage.remove();
      }


      /*
       * Restore saved conversation.
       */
      data.messages.forEach((message) => {

        if (
          !message ||
          typeof message.content !== 'string'
        ) {
          return;
        }


        const sender =
          message.role === 'user'
            ? 'user'
            : 'ai';


        addMessage(
          message.content,
          sender
        );
      });


      scrollToBottom();

    } catch (error) {

      console.error(
        'CakeOClock AI session load error:',
        error
      );

    }
  }


  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  async function sendMessage() {

    const message =
      input.value.trim();


    /*
     * Prevent empty or duplicate messages.
     */
    if (
      !message ||
      isSending
    ) {
      return;
    }


    /*
     * Show user's message immediately.
     */
    addMessage(
      message,
      'user'
    );


    /*
     * Clear input.
     */
    input.value = '';

    autoResize();

    setLoading(true);


    try {

      const response =
        await fetch(
          '/api/chatbot/message',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'Accept':
                'application/json'
            },

            credentials: 'same-origin',

            body: JSON.stringify({
              message: message
            })
          }
        );


      let data = null;


      try {

        data =
          await response.json();

      } catch (parseError) {

        console.error(
          'Chatbot response parsing error:',
          parseError
        );

      }


      /*
       * Authentication/session expired.
       */
      if (response.status === 401) {

        addMessage(
          'Your session has expired. Please log in again to continue chatting.',
          'ai'
        );

        return;
      }


      /*
       * Backend/service error.
       */
      if (!response.ok) {

        throw new Error(
          data?.message ||
          'Unable to connect to CakeOClock AI.'
        );
      }


      /*
       * Validate response structure.
       */
      if (
        !data ||
        !data.success ||
        typeof data.response !== 'string'
      ) {

        throw new Error(
          'CakeOClock AI returned an invalid response.'
        );
      }


      /*
       * Display AI response.
       */
      addMessage(
        data.response,
        'ai'
      );

    } catch (error) {

      console.error(
        'CakeOClock AI error:',
        error
      );


      addMessage(
        'Sorry, I’m unable to connect to CakeOClock AI right now. Please try again in a moment.',
        'ai'
      );

    } finally {

      setLoading(false);

      input.focus();
    }
  }


  /* ==========================================================
     EVENT LISTENERS
  ========================================================== */

  launcher.addEventListener(
    'click',
    function () {

      if (isOpen) {
        closeChatbot();
      } else {
        openChatbot();
      }

    }
  );


  closeButton.addEventListener(
    'click',
    closeChatbot
  );


  sendButton.addEventListener(
    'click',
    sendMessage
  );


  input.addEventListener(
    'input',
    autoResize
  );


  input.addEventListener(
    'keydown',
    function (event) {

      /*
       * Enter = send
       *
       * Shift + Enter = new line
       */
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();
      }

    }
  );


  /* ==========================================================
     ESCAPE KEY
  ========================================================== */

  document.addEventListener(
    'keydown',
    function (event) {

      if (
        event.key === 'Escape' &&
        isOpen
      ) {
        closeChatbot();
      }

    }
  );


  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  autoResize();

  /*
   * Load the authenticated user's active
   * chatbot session.
   */
  loadChatSession();

})();