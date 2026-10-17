
import "./styles/main.css";

type Format = "zip" | "tar" | "tar.gz";

interface ArchiveEntry {
    path: string;
    directory: boolean;
}

interface Progress {
    processed: number;
    total: number;
    percent: number;
}

const $ = <T extends HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector);

    if (!element) {
        throw new Error(`Missing element: ${selector}`);
    }

    return element;
};

const createView = $("#create-view");
const createIntro = $("#create-intro");
const archiveBrowser = $("#archive-browser");
const pageTitle = $("#page-title");

const createNav = $("#create-archive-nav");
const openNav = $("#open-archives");

const sourceName = $("#source-name");
const sourcePath = $("#source-path");
const outputName = $("#output-name");

const selectFolder = $("#select-folder");
const selectOutput = $("#select-output");
const createButton = $<HTMLButtonElement>("#create-archive");

const createMessage = $("#create-message");
const createProgressSection = $("#create-progress-section");
const createProgressLabel = $("#create-progress-label");
const createProgressPercent = $("#create-progress-percent");
const createProgressBar = $("#create-progress-bar");
const createProgressTrack = createProgressBar.parentElement as HTMLElement;

const selectArchive = $("#select-archive");
const archiveName = $("#archive-name");
const archivePath = $("#archive-path");
const archiveCount = $("#archive-count");
const archiveEntries = $("#archive-entries");
const archiveEmpty = $("#archive-empty");
const archiveError = $("#archive-message");

const selectExtractFolder = $("#select-extract-folder");
const extractDestinationName = $("#extract-destination-name");
const extractDestinationPath = $("#extract-destination-path");
const extractButton = $<HTMLButtonElement>("#extract-archive");

const extractProgressSection = $("#extract-progress-section");
const extractProgressLabel = $("#extract-progress-label");
const extractProgressPercent = $("#extract-progress-percent");
const extractProgressBar = $("#extract-progress-bar");
const extractProgressTrack = extractProgressBar.parentElement as HTMLElement;

let source: string | null = null;
let destination: string | null = null;
let format: Format = "zip";

let openedArchive: string | null = null;
let extractionDestination: string | null = null;
let archiveOperationRunning = false;

function showMessage(
    element: HTMLElement,
    text: string,
    kind: "success" | "error" | "info" = "info"
): void {
    element.textContent = text;
    element.className = `message${kind === "info" ? "" : ` message--${kind}`}`;
}

function updateCreateButton(): void {
    createButton.disabled =
        archiveOperationRunning || !source || !destination;
}

function updateExtractButton(): void {
    extractButton.disabled =
        archiveOperationRunning ||
        !openedArchive ||
        !extractionDestination;
}

function updateOutputName(): void {
    outputName.textContent = destination
        ? destination.split(/[\\/]/).pop() || destination
        : `archive.${format}`;
}

function setActiveView(view: "create" | "open"): void {
    const creating = view === "create";

    createView.hidden = !creating;
    createIntro.hidden = !creating;
    archiveBrowser.hidden = creating;

    createNav.classList.toggle("nav-item--active", creating);
    openNav.classList.toggle("nav-item--active", !creating);

    createNav.toggleAttribute("aria-current", creating);
    openNav.toggleAttribute("aria-current", !creating);

    if (creating) {
        createNav.setAttribute("aria-current", "page");
        openNav.removeAttribute("aria-current");
    } else {
        openNav.setAttribute("aria-current", "page");
        createNav.removeAttribute("aria-current");
    }

    pageTitle.textContent = creating ? "Create Archive" : "Open Archives";
}

function updateProgress(
    section: HTMLElement,
    label: HTMLElement,
    percentLabel: HTMLElement,
    bar: HTMLElement,
    track: HTMLElement,
    progress: Progress
): void {
    section.hidden = false;

    const percent = Math.max(0, Math.min(100, progress.percent));

    percentLabel.textContent = `${percent}%`;
    label.textContent =
        `${progress.processed} of ${progress.total} entries processed`;

    bar.style.width = `${percent}%`;
    track.setAttribute("aria-valuenow", String(percent));
}

function resetProgress(
    section: HTMLElement,
    label: HTMLElement,
    percentLabel: HTMLElement,
    bar: HTMLElement,
    track: HTMLElement,
    initialLabel: string
): void {
    section.hidden = true;
    label.textContent = initialLabel;
    percentLabel.textContent = "0%";
    bar.style.width = "0%";
    track.setAttribute("aria-valuenow", "0");
}

function renderArchiveEntries(entries: ArchiveEntry[]): void {
    archiveEntries.replaceChildren();
    archiveEmpty.hidden = entries.length > 0;
    archiveEntries.hidden = entries.length === 0;

    for (const entry of entries) {
        const item = document.createElement("li");
        item.className = entry.directory
            ? "archive-entry archive-entry--directory"
            : "archive-entry";

        const icon = document.createElement("span");
        icon.className = "archive-entry__icon";
        icon.textContent = entry.directory ? "▰" : "▤";
        icon.setAttribute("aria-hidden", "true");

        const name = document.createElement("span");
        name.className = "archive-entry__name";
        name.textContent = entry.path;
        name.title = entry.path;

        const type = document.createElement("span");
        type.className = "archive-entry__type";
        type.textContent = entry.directory ? "Folder" : "File";

        item.append(icon, name, type);
        archiveEntries.append(item);
    }

    archiveCount.textContent = entries.length === 1
        ? "1 entry"
        : `${entries.length} entries`;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
}

async function chooseSourceFolder(): Promise<void> {
    try {
        const selected = await window.packForge.selectFolder();
        if (!selected) return;

        source = selected;
        sourceName.textContent =
            selected.split(/[\\/]/).pop() || selected;
        sourcePath.textContent = selected;

        updateCreateButton();
        showMessage(createMessage, "Source folder selected.");
    } catch (error) {
        showMessage(createMessage, getErrorMessage(error), "error");
    }
}

async function chooseOutput(): Promise<void> {
    try {
        const selected = await window.packForge.saveArchive(format);
        if (!selected) return;

        destination = selected;
        updateOutputName();
        updateCreateButton();

        showMessage(createMessage, "Output location selected.");
    } catch (error) {
        showMessage(createMessage, getErrorMessage(error), "error");
    }
}

async function chooseArchive(): Promise<void> {
    try {
        const selected = await window.packForge.openArchive();
        if (!selected) return;

        openedArchive = selected;
        extractionDestination = null;

        archiveName.textContent =
            selected.split(/[\\/]/).pop() || selected;
        archivePath.textContent = selected;

        extractDestinationName.textContent = "No destination selected";
        extractDestinationPath.textContent = "Choose an extraction folder.";

        archiveEntries.replaceChildren();
        archiveEmpty.hidden = false;
        archiveEntries.hidden = true;
        archiveEmpty.querySelector("strong")!.textContent = "Loading archive...";
        archiveEmpty.querySelector("p")!.textContent =
            "Reading the archive contents.";

        archiveCount.textContent = "Loading entries...";
        archiveError.textContent = "";

        updateExtractButton();

        const entries = await window.packForge.listArchive(selected);
        renderArchiveEntries(entries);

        archiveEmpty.querySelector("strong")!.textContent =
            "No archive opened";
        archiveEmpty.querySelector("p")!.textContent =
            "Select an archive to display its files and folders.";

        showMessage(archiveError, "Archive opened successfully.", "success");
    } catch (error) {
        archiveEmpty.hidden = false;
        archiveEntries.hidden = true;

        archiveEmpty.querySelector("strong")!.textContent =
            "Unable to open archive";
        archiveEmpty.querySelector("p")!.textContent =
            getErrorMessage(error);

        showMessage(archiveError, getErrorMessage(error), "error");
    }
}

async function chooseExtractionFolder(): Promise<void> {
    try {
        const selected =
            await window.packForge.selectExtractFolder();

        if (!selected) return;

        extractionDestination = selected;

        extractDestinationName.textContent =
            selected.split(/[\\/]/).pop() || selected;
        extractDestinationPath.textContent = selected;

        updateExtractButton();
        showMessage(archiveError, "Extraction destination selected.");
    } catch (error) {
        showMessage(archiveError, getErrorMessage(error), "error");
    }
}

async function runExtraction(): Promise<void> {
    if (!openedArchive || !extractionDestination) return;
    if (archiveOperationRunning) return;

    archiveOperationRunning = true;
    updateCreateButton();
    updateExtractButton();

    extractProgressSection.hidden = false;
    extractProgressLabel.textContent = "Extracting archive...";
    extractProgressPercent.textContent = "Please wait";
    extractProgressBar.style.width = "40%";

    showMessage(archiveError, "Extraction in progress...");

    try {
        await window.packForge.extractArchive(
            openedArchive,
            extractionDestination
        );

        extractProgressBar.style.width = "100%";
        extractProgressPercent.textContent = "100%";
        extractProgressLabel.textContent = "Extraction completed";

        showMessage(
            archiveError,
            "Archive extracted successfully.",
            "success"
        );
    } catch (error) {
        resetProgress(
            extractProgressSection,
            extractProgressLabel,
            extractProgressPercent,
            extractProgressBar,
            extractProgressTrack,
            "Extraction failed"
        );

        showMessage(archiveError, getErrorMessage(error), "error");
    } finally {
        archiveOperationRunning = false;
        updateCreateButton();
        updateExtractButton();
    }
}

async function runCreation(): Promise<void> {
    if (!source || !destination || archiveOperationRunning) return;

    archiveOperationRunning = true;
    updateCreateButton();
    updateExtractButton();

    createProgressSection.hidden = false;
    createProgressLabel.textContent = "Creating archive...";
    createProgressPercent.textContent = "0%";
    createProgressBar.style.width = "0%";

    showMessage(createMessage, "Archive creation in progress...");

    try {
        await window.packForge.createArchive(
            source,
            destination,
            format
        );

        createProgressBar.style.width = "100%";
        createProgressPercent.textContent = "100%";
        createProgressLabel.textContent = "Archive creation completed";

        createProgressTrack.setAttribute("aria-valuenow", "100");

        showMessage(
            createMessage,
            "Archive created successfully.",
            "success"
        );
    } catch (error) {
        showMessage(createMessage, getErrorMessage(error), "error");
    } finally {
        archiveOperationRunning = false;
        updateCreateButton();
        updateExtractButton();
    }
}

document.querySelectorAll<HTMLButtonElement>("[data-format]")
    .forEach((button) => {
        button.addEventListener("click", () => {
            if (archiveOperationRunning) return;

            const selected = button.dataset.format;

            if (
                selected !== "zip" &&
                selected !== "tar" &&
                selected !== "tar.gz"
            ) {
                return;
            }

            format = selected;
            destination = null;

            document.querySelectorAll<HTMLButtonElement>("[data-format]")
                .forEach((card) => {
                    const active = card === button;

                    card.classList.toggle("format-card--active", active);
                    card.setAttribute("aria-pressed", String(active));
                });

            updateOutputName();
            updateCreateButton();

            showMessage(
                createMessage,
                `${format.toUpperCase()} format selected. Choose an output location.`
            );
        });
    });

createNav.addEventListener("click", () => setActiveView("create"));
openNav.addEventListener("click", () => setActiveView("open"));

selectFolder.addEventListener("click", () => void chooseSourceFolder());
selectOutput.addEventListener("click", () => void chooseOutput());
createButton.addEventListener("click", () => void runCreation());

selectArchive.addEventListener("click", () => void chooseArchive());

selectExtractFolder.addEventListener(
    "click",
    () => void chooseExtractionFolder()
);

extractButton.addEventListener("click", () => void runExtraction());

window.packForge.onProgress((progress) => {
    updateProgress(
        createProgressSection,
        createProgressLabel,
        createProgressPercent,
        createProgressBar,
        createProgressTrack,
        progress
    );
});

resetProgress(
    createProgressSection,
    createProgressLabel,
    createProgressPercent,
    createProgressBar,
    createProgressTrack,
    "Preparing archive..."
);

resetProgress(
    extractProgressSection,
    extractProgressLabel,
    extractProgressPercent,
    extractProgressBar,
    extractProgressTrack,
    "Preparing extraction..."
);

archiveEntries.hidden = true;
archiveEmpty.hidden = false;

updateOutputName();
updateCreateButton();
updateExtractButton();
setActiveView("create");
