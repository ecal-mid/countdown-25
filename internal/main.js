import {
	SequenceRunner,
	loadSequenceMetadata,
} from "./sequenceRunner.js";

import { initMenu, initTransitionUI } from "./sequenceRunnerUI.js";


const sequenceResponse = await fetch("./sequence.json")
let sequenceData
try {

	const sequence = await sequenceResponse.json()
	sequenceData = await loadSequenceMetadata(sequence)
}
catch (e) {
	console.error("Can't parse sequence.json, error:", e)
}

if (sequenceData) {

	sequenceData.forEach(s => {
		let nextNum = Number.parseInt(s.content) - 1
		if (nextNum < 0)
			nextNum = 3
		s.nextContent = nextNum.toString()
	})

	//console.log(sequenceData);
	const runner = new SequenceRunner(sequenceData, "3");

	initMenu(runner)
	initTransitionUI(runner)

	runner.restart()

}