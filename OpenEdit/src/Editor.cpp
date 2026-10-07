#include "Editor.hpp"
#include "FileManager.hpp"

#include <algorithm>
#include <cstdio>
#include <filesystem>
#include <stdexcept>

Editor::Editor() : input_(terminal_), renderer_(terminal_) {}

void Editor::message(const std::string& text) {
    status_ = text;
}

void Editor::open(const std::filesystem::path& path) {
    if (std::filesystem::exists(path)) {
        FileManager::load(path, document_);
        path_ = path;
        cursor_.setPosition(0, 0, document_);
        modified_ = false;
        message("Opened: " + path.string());
        return;
    }

    path_ = path;
    document_.clear();
    cursor_.setPosition(0, 0, document_);
    modified_ = false;
    message("New file: " + path.string());
}

bool Editor::save() {
    if (path_.empty()) {
        return saveAs();
    }

    try {
        FileManager::save(path_, document_);
        modified_ = false;
        message("Saved: " + path_.string());
        return true;
    } catch (const std::exception& e) {
        message(std::string("Error: ") + e.what());
        return false;
    }
}

std::string Editor::prompt(const std::string& text) {
    terminal_.showCursor();
    return input_.readLine(text);
}

bool Editor::saveAs() {
    const std::string entered =
        prompt("Save as (Esc cancels): ");

    if (entered.empty()) {
        message("Save As cancelled.");
        return false;
    }

    const auto newPath =
        std::filesystem::path(entered);

    if (std::filesystem::exists(newPath) &&
        std::filesystem::is_directory(newPath)) {

        message("Error: target is a directory.");
        return false;
    }

    const auto oldPath = path_;

    path_ = newPath;

    if (save()) {
        return true;
    }

    path_ = oldPath;
    return false;
}

bool Editor::newDocument() {
    if (modified_) {
        const std::string answer =
            prompt(
                "Unsaved changes. Save before creating new document? [Y/n] "
            );

        if (!answer.empty() &&
            (answer[0] == 'n' || answer[0] == 'N')) {

            // Continue without saving.

        } else if (!save()) {
            return false;
        }
    }

    document_.clear();
    path_.clear();

    cursor_.setPosition(
        0,
        0,
        document_
    );

    modified_ = false;
    message("New document.");

    return true;
}

bool Editor::quit() {
    if (!modified_) {
        return true;
    }

    const std::string answer =
        prompt(
            "Unsaved changes. Save before exiting? [Y/n] "
        );

    if (answer.empty() ||
        answer[0] == 'y' ||
        answer[0] == 'Y') {

        return save();
    }

    if (answer[0] == 'n' ||
        answer[0] == 'N') {

        return true;
    }

    message("Quit cancelled.");
    return false;
}

void Editor::find() {
    const std::string needle =
        prompt("Find (Esc cancels): ");

    if (needle.empty()) {
        message("Search cancelled.");
        return;
    }

    for (
        std::size_t r = cursor_.row();
        r < document_.lineCount();
        ++r
    ) {
        const auto& line =
            document_.line(r);

        const std::size_t start =
            (r == cursor_.row())
                ? cursor_.column()
                : 0;

        const std::size_t pos =
            line.find(needle, start);

        if (pos != std::string::npos) {
            cursor_.setPosition(
                r,
                pos,
                document_
            );

            message("Found: " + needle);
            return;
        }
    }

    for (
        std::size_t r = 0;
        r <= cursor_.row() &&
        r < document_.lineCount();
        ++r
    ) {
        const auto& line =
            document_.line(r);

        const std::size_t pos =
            line.find(needle);

        if (pos != std::string::npos) {
            cursor_.setPosition(
                r,
                pos,
                document_
            );

            message("Found: " + needle);
            return;
        }
    }

    message("Not found: " + needle);
}

void Editor::insertCharacter(char c) {
    document_.insertChar(
        cursor_.row(),
        cursor_.column(),
        c
    );

    cursor_.setPosition(
        cursor_.row(),
        cursor_.column() + 1,
        document_
    );

    modified_ = true;
    status_.clear();
}

void Editor::deleteForward() {
    const auto row = cursor_.row();
    const auto col = cursor_.column();

    if (col < document_.line(row).size()) {
        document_.eraseChar(
            row,
            col
        );

        modified_ = true;

    } else if (
        row + 1 < document_.lineCount()
    ) {
        document_.line(row) +=
            document_.line(row + 1);

        document_.lines().erase(
            document_.lines().begin() +
            static_cast<std::ptrdiff_t>(row + 1)
        );

        modified_ = true;
    }
}

void Editor::adjustViewport() {
    const auto [rows, cols] =
        terminal_.size();

    const std::size_t contentRows =
        rows > 4 ? rows - 4 : 1;

    if (cursor_.row() < scrollRow_) {
        scrollRow_ = cursor_.row();
    }

    if (
        cursor_.row() >=
        scrollRow_ + contentRows
    ) {
        scrollRow_ =
            cursor_.row() -
            contentRows +
            1;
    }

    if (
        cursor_.column() <
        scrollColumn_
    ) {
        scrollColumn_ =
            cursor_.column();
    }

    if (
        cursor_.column() >=
        scrollColumn_ +
        static_cast<std::size_t>(cols)
    ) {
        scrollColumn_ =
            cursor_.column() -
            static_cast<std::size_t>(cols) +
            1;
    }
}

void Editor::handleKey(const Key& key) {
    switch (key.type) {

        case KeyType::Character:
            insertCharacter(key.character);
            break;

        case KeyType::Enter:
            document_.insertNewline(
                cursor_.row(),
                cursor_.column()
            );

            cursor_.setPosition(
                cursor_.row() + 1,
                0,
                document_
            );

            modified_ = true;
            status_.clear();
            break;

        case KeyType::Backspace:
            if (cursor_.column() > 0) {

                document_.backspace(
                    cursor_.row(),
                    cursor_.column()
                );

                cursor_.setPosition(
                    cursor_.row(),
                    cursor_.column() - 1,
                    document_
                );

                modified_ = true;

            } else if (cursor_.row() > 0) {

                const auto oldLen =
                    document_.line(
                        cursor_.row() - 1
                    ).size();

                document_.backspace(
                    cursor_.row(),
                    0
                );

                cursor_.setPosition(
                    cursor_.row() - 1,
                    oldLen,
                    document_
                );

                modified_ = true;
            }

            status_.clear();
            break;

        case KeyType::Delete:
            deleteForward();
            status_.clear();
            break;

        case KeyType::ArrowLeft:
            cursor_.left(document_);
            break;

        case KeyType::ArrowRight:
            cursor_.right(document_);
            break;

        case KeyType::ArrowUp:
            cursor_.up(document_);
            break;

        case KeyType::ArrowDown:
            cursor_.down(document_);
            break;

        case KeyType::Home:
            cursor_.home();
            break;

        case KeyType::End:
            cursor_.end(document_);
            break;

        case KeyType::CtrlS:
            save();
            break;

        case KeyType::CtrlO: {
            const auto entered =
                prompt("Open file (Esc cancels): ");

            if (!entered.empty()) {
                try {
                    open(entered);
                } catch (
                    const std::exception& e
                ) {
                    message(
                        std::string("Error: ") +
                        e.what()
                    );
                }
            } else {
                message("Open cancelled.");
            }

            break;
        }

        case KeyType::CtrlN:
            newDocument();
            break;

        case KeyType::CtrlQ:
            if (quit()) {
                throw std::runtime_error(
                    "__OPENEDIT_QUIT__"
                );
            }
            break;

        case KeyType::CtrlF:
            find();
            break;

        case KeyType::Escape:
            break;

        default:
            break;
    }

    adjustViewport();
}

int Editor::run(
    const std::filesystem::path& initialPath) {

    try {
        if (!initialPath.empty()) {
            try {
                open(initialPath);
            } catch (
                const std::exception& e) {

                terminal_.enableRawMode();
                terminal_.restore();

                std::fprintf(
                    stderr,
                    "OpenEdit: %s\n",
                    e.what()
                );

                return 1;
            }
        }

        terminal_.enableRawMode();

        // Draw the initial screen before waiting
        // for the first key.
        adjustViewport();

        renderer_.draw(
            document_,
            cursor_,
            path_,
            modified_,
            scrollRow_,
            scrollColumn_,
            status_
        );

        while (true) {

            try {
                // Wait for input first.
                handleKey(
                    input_.readKey()
                );

            } catch (
                const std::runtime_error& e) {

                if (
                    std::string(e.what()) ==
                    "__OPENEDIT_QUIT__"
                ) {
                    break;
                }

                throw;
            }

            // Immediately redraw after every change.
            adjustViewport();

            renderer_.draw(
                document_,
                cursor_,
                path_,
                modified_,
                scrollRow_,
                scrollColumn_,
                status_
            );
        }

        terminal_.restore();
        terminal_.clearScreen();
        terminal_.showCursor();

        std::fflush(stdout);

        return 0;

    } catch (
        const std::exception& e) {

        terminal_.restore();
        terminal_.showCursor();

        std::fprintf(
            stderr,
            "\nOpenEdit: %s\n",
            e.what()
        );

        return 1;
    }
}
