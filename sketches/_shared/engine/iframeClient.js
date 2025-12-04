


export function createIframeClient() {

    const isInIframe = window.self !== window.top

    const STATE = {
        WAITING: "waiting",
        RUNNING: "running",
        FINISHED: "finished"
    }

    let state = STATE.RUNNING
    if (isInIframe) {

        state = STATE.WAITING
        window.addEventListener(
            "message",
            async (event) => {
                if (event.data === "started") {
                    if (state === STATE.WAITING)
                        state = STATE.RUNNING
                }
            },
            false
        );
    }


    window.addEventListener("keydown", (event) => {
        if (event.key === "n")
            sendFinishSignal();
    }, {
        capture: true
    });

    function sendFinishSignal() {
        console.log("sketch finished, starting the next one.");
        window.parent.postMessage("finished", "*");

        state = STATE.FINISHED
    }

    return {
        sendFinishSignal,
        STATE,
        getState: () => state
    }
}