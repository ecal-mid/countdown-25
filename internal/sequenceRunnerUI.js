
export function initMenu(sequencePlayer) {

    const menu = document.getElementById("menu");

    document.querySelectorAll("[data-toggle-menu]").forEach(el => el.addEventListener("click", () => {
        menu.classList.toggle("hidden");
    }))

    // on li with class author click filter the sequence
    menu.addEventListener("click", (e) => {
        if (e.target.classList.contains("author")) {

            menu.classList.toggle("hidden");
            const filter = e.target.getAttribute("author-name")

            sequencePlayer.setFilter(filter === "random" ? undefined : filter)
            sequencePlayer.restart()

            showFilter()
        }

    });

    function showFilter() {

        // if current author highlight the li
        document
            .querySelectorAll(".author")
            .forEach((link) =>
                link.classList.toggle(
                    "selected",
                    link.getAttribute("author-name") === sequencePlayer.currentFilter ||
                    (link.getAttribute("author-name") === "random" && sequencePlayer.currentFilter === undefined)
                )
            );
    }



    // Fill menu
    const authorNames = sequencePlayer.sequences
        .map((item) => item.author)
        .sort()
        .filter((value, index, self) => self.indexOf(value) === index);

    const liElements = authorNames.map(
        (name) => `<li class="author link" author-name="${name}">${name}</li>`
    );
    const ulInnerHTML = liElements.join("");

    // get div with id inside menu div
    const authorList = document.getElementById("authorList");
    authorList.innerHTML = `<ul><li class="author link selected" author-name="random">Random</li>${ulInnerHTML}</ul>`;


    showFilter()

}


let transition;
export function initTransitionUI(sequencePlayer) {


    const index = document.getElementById("index");
    const authorName = document.getElementById("authorName");
    sequencePlayer.addEventListener("sequencechanged", (e) => {

        if (sequencePlayer.currentFilter === undefined) {
            authorName.innerHTML = e.detail.author;
            authorName.style.opacity = "1";
        } else {
            authorName.innerHTML = "";
            authorName.style.opacity = "0";
        }

        // index.innerHTML = `<div class="link">${sequencePlayer.getCurrentSequenceId() + 1}/${sequencePlayer.sequencesFiltered.length }</div>`;

        //set timeout to fade out authorName
        clearTimeout(transition);

        transition = setTimeout(() => {
            authorName.style.opacity = "0";
        }, 3000);
    })



}