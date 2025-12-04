async function loadIframe(url, target) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.addEventListener("load", (ev) => {
      resolve(iframe);
    });
    target.appendChild(iframe);
  });
}

function getFilterFromUrl() {
  // split hash into elements (works with any number of hash parameters)
  const hashElements = window.location.hash.substring(1).split("&")
  for (const element of hashElements) {
    if (element.startsWith("filter=")) {
      const hashFilter = decodeURIComponent(element.substring(7))
      if (hashFilter.length > 0) {
        console.log("found filter in url hash:", hashFilter)
        return hashFilter
      }

    }
  }
  return undefined
}

export class SequenceRunner extends EventTarget {

  sequencesFiltered;
  currentFilter;
  currentSequence;
  preloadedSequence;
  main;

  constructor(sequences, startContent) {

    super()

    this.main = document.querySelector("main");
    this.sequences = sequences
    this.startContent = startContent


    window.onpopstate = (event) => {
      this.setFilter(getFilterFromUrl())
      this.restart()
    }

    this.setFilter(getFilterFromUrl())

    window.addEventListener(
      "message",
      async (event) => {
        if (event.data === "finished") {
          this.activatePreloaded();
        }
      },
      false
    );
  }



  show(isVisible) {

    this.main.style.visibility = isVisible ? "visible" : "hidden";
  }

  async activatePreloaded() {

    if (!this.preloadedSequence) {
      console.warn("no preloaded sequence to activate")
      return;
    }


    if (this.currentSequence) {
      this.main.removeChild(this.currentSequence.iframe);
      this.currentSequence = undefined
    }

    this.currentSequence = this.preloadedSequence
    this.preloadedSequence = undefined
    console.log("activate sequence", this.currentSequence)

    this.dispatchEvent(new CustomEvent("sequencechanged", { detail: this.sequencesFiltered[this.currentSequence.sequenceId] }))

    if (this.currentSequence) {
      this.currentSequence.iframe.style = "z-index:99";
      this.currentSequence.iframe.contentWindow.focus()
      this.currentSequence.iframe.contentWindow.postMessage("started", "*")
      this.sequencesFiltered[this.currentSequence.sequenceId].count++
    }

    const nextSequenceId = selectNextSequenceId(
      this.currentSequence ? this.sequencesFiltered[this.currentSequence.sequenceId].nextContent : undefined,
      this.sequencesFiltered
    );

    this.preload(nextSequenceId)
  }

  async preload(sequenceIdToLoad) {

    if (this.preloadedSequence) {
      throw "preload called while already preloading"
    }

    console.log("preloading", this.sequencesFiltered[sequenceIdToLoad])
    const iframe = await loadIframe(this.sequencesFiltered[sequenceIdToLoad].url, this.main)
    iframe.style = "z-index:-99";

    this.preloadedSequence = {
      sequenceId: sequenceIdToLoad,
      iframe: iframe,
    };
  }

  async setFilter(filter) {
    console.log("set filter", filter)

    this.currentFilter = filter
    this.sequencesFiltered = this.sequences
      .filter((seq) => this.currentFilter == undefined || seq.author === this.currentFilter)
      .map(seq => Object.assign({}, seq, { count: 0 }))

    const hash = filter ? `#filter=${encodeURIComponent(filter)}` : ""
    if (window.location.hash !== hash)
      history.pushState(null, "", window.location.pathname + hash)

    this.clear()
  }

  clear() {

    if (this.currentSequence) {
      if (this.currentSequence.iframe)
        this.main.removeChild(this.currentSequence.iframe);
      this.currentSequence = undefined
    }
    if (this.preloadedSequence) {
      if (this.preloadedSequence.iframe)
        this.main.removeChild(this.preloadedSequence.iframe);
      this.preloadedSequence = undefined
    }

  }

  async restart() {

    const startContentSequences = this.sequencesFiltered.filter(s => s.content === this.startContent)
    if (startContentSequences.length <= 0)
      console.error("Can't find start sequence with content:", this.startContent, "sequences: ", this.sequences)
    const sequence = startContentSequences[Math.floor(Math.random() * startContentSequences.length)]
    const globalSequenceId = this.sequencesFiltered.indexOf(sequence)
    await this.preload(globalSequenceId)

    this.activatePreloaded()

    this.show(true)
  }

  getCurrentSequenceId() {
    return this.currentSequence ? this.currentSequence.sequenceId : -1
  }
}


function selectNextSequenceId(content, sequences) {

  console.log("find seq", content, sequences)
  const matchingSequenceIds = sequences
    .map((seq, index) => index) // Map each sequence to an object with the sequence and its index
    .filter((seqId) => {
      // Filter based on the content
      return (
        sequences[seqId].content.toString() === content
      );
    });
  console.log(matchingSequenceIds)

  sequences.forEach(seq => { seq.count = Math.max(1, seq.count) })
  const lowestCount = matchingSequenceIds
    .map(seqId => sequences[seqId].count)
    .reduce((prev, curr) => {
      return Math.min(prev, curr)
    }, Number.POSITIVE_INFINITY)

  const matchingSequencesWithLowestCount = matchingSequenceIds
    .filter(seqId => (sequences[seqId].count) === lowestCount)

  if (matchingSequencesWithLowestCount.length > 0) {
    const randomIndex = Math.floor(Math.random() * matchingSequencesWithLowestCount.length);
    return matchingSequencesWithLowestCount[randomIndex]; // Return the index of the selected sequence
  }

  return 0; // Return 0 if no matching sequence is found
}


export async function loadSequenceMetadata(urls) {
  let sequenceData = await Promise.all(
    urls.map(async (url) => {
      const infoUrl = url + "/info.json";
      try {
        const response = await fetch(infoUrl);
        const data = await response.json();
        return Object.assign(
          {},
          {
            url: url,
          },
          data
        );
      } catch (e) { }
    })
  );
  sequenceData = sequenceData.filter((o) => o !== undefined);

  return sequenceData;
}

