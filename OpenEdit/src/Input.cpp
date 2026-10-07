#include "Input.hpp"
#include "Terminal.hpp"

#ifdef _WIN32

#include <windows.h>

namespace {

std::string wideToUtf8(wchar_t character) {
    if (character == L'\0') {
        return {};
    }

    const int size = WideCharToMultiByte(
        CP_UTF8,
        0,
        &character,
        1,
        nullptr,
        0,
        nullptr,
        nullptr
    );

    if (size <= 0) {
        return {};
    }

    std::string result(size, '\0');

    WideCharToMultiByte(
        CP_UTF8,
        0,
        &character,
        1,
        result.data(),
        size,
        nullptr,
        nullptr
    );

    return result;
}

}

Input::Input(Terminal& terminal)
    : terminal_(terminal) {
}

InputEvent Input::read() {
    if (!pendingCharacters_.empty()) {
        const char c = pendingCharacters_.front();
        pendingCharacters_.pop_front();

        return {
            InputType::Character,
            c
        };
    }

    return readWindows();
}

Key Input::readKey() {
    return read();
}

InputEvent Input::readWindows() {
    HANDLE inputHandle = GetStdHandle(STD_INPUT_HANDLE);

    if (inputHandle == INVALID_HANDLE_VALUE ||
        inputHandle == nullptr) {
        return {};
    }

    while (true) {
        INPUT_RECORD record{};
        DWORD eventsRead = 0;

        if (!ReadConsoleInputW(
                inputHandle,
                &record,
                1,
                &eventsRead)) {
            return {};
        }

        if (record.EventType != KEY_EVENT) {
            continue;
        }

        const KEY_EVENT_RECORD& key = record.Event.KeyEvent;

        if (!key.bKeyDown) {
            continue;
        }

        const WORD virtualKey = key.wVirtualKeyCode;
        const wchar_t character = key.uChar.UnicodeChar;
        const DWORD controlState = key.dwControlKeyState;

        const bool ctrlPressed =
            (controlState & LEFT_CTRL_PRESSED) ||
            (controlState & RIGHT_CTRL_PRESSED);

        if (ctrlPressed) {
            switch (virtualKey) {
                case 'S':
                    return {InputType::CtrlS, '\0'};

                case 'O':
                    return {InputType::CtrlO, '\0'};

                case 'N':
                    return {InputType::CtrlN, '\0'};

                case 'F':
                    return {InputType::CtrlF, '\0'};

                case 'Q':
                    return {InputType::CtrlQ, '\0'};

                default:
                    break;
            }
        }

        switch (virtualKey) {
            case VK_LEFT:
                return {InputType::ArrowLeft, '\0'};

            case VK_RIGHT:
                return {InputType::ArrowRight, '\0'};

            case VK_UP:
                return {InputType::ArrowUp, '\0'};

            case VK_DOWN:
                return {InputType::ArrowDown, '\0'};

            case VK_HOME:
                return {InputType::Home, '\0'};

            case VK_END:
                return {InputType::End, '\0'};

            case VK_BACK:
                return {InputType::Backspace, '\0'};

            case VK_DELETE:
                return {InputType::Delete, '\0'};

            case VK_RETURN:
                return {InputType::Enter, '\0'};

            case VK_ESCAPE:
                return {InputType::Escape, '\0'};

            default:
                break;
        }

        if (character != L'\0' && !ctrlPressed) {
            const std::string utf8 = wideToUtf8(character);

            if (!utf8.empty()) {
                for (const char byte : utf8) {
                    pendingCharacters_.push_back(byte);
                }

                const char first = pendingCharacters_.front();
                pendingCharacters_.pop_front();

                return {
                    InputType::Character,
                    first
                };
            }
        }
    }
}

std::string Input::readLine(const std::string& prompt) {
    std::string result;

    // Make sure the prompt is visible.
    std::printf("%s", prompt.c_str());
    std::fflush(stdout);

    while (true) {
        const Key key = readKey();

        switch (key.type) {
            case KeyType::Character:
                result += key.character;
                std::printf("%c", key.character);
                std::fflush(stdout);
                break;

            case KeyType::Backspace:
                if (!result.empty()) {
                    result.pop_back();

                    std::printf("\b \b");
                    std::fflush(stdout);
                }
                break;

            case KeyType::Enter:
                std::printf("\n");
                std::fflush(stdout);
                return result;

            case KeyType::Escape:
                std::printf("\n");
                std::fflush(stdout);
                return {};

            default:
                break;
        }
    }
}

#else

#include <unistd.h>
#include <termios.h>

Input::Input(Terminal& terminal)
    : terminal_(terminal) {
}

InputEvent Input::read() {
    if (!pendingCharacters_.empty()) {
        const char c = pendingCharacters_.front();
        pendingCharacters_.pop_front();

        return {
            InputType::Character,
            c
        };
    }

    return readLinux();
}

Key Input::readKey() {
    return read();
}

InputEvent Input::readLinux() {
    char c;

    if (read(STDIN_FILENO, &c, 1) != 1) {
        return {};
    }

    if (c == 3) {
        return {InputType::CtrlQ, '\0'};
    }

    if (c == 19) {
        return {InputType::CtrlS, '\0'};
    }

    if (c == 15) {
        return {InputType::CtrlO, '\0'};
    }

    if (c == 14) {
        return {InputType::CtrlN, '\0'};
    }

    if (c == 6) {
        return {InputType::CtrlF, '\0'};
    }

    if (c == '\r' || c == '\n') {
        return {InputType::Enter, '\0'};
    }

    if (c == 127 || c == '\b') {
        return {InputType::Backspace, '\0'};
    }

    if (c == 27) {
        char sequence[3]{};

        if (read(STDIN_FILENO, &sequence[0], 1) != 1) {
            return {InputType::Escape, '\0'};
        }

        if (sequence[0] != '[') {
            return {InputType::Escape, '\0'};
        }

        if (read(STDIN_FILENO, &sequence[1], 1) != 1) {
            return {};
        }

        switch (sequence[1]) {
            case 'A':
                return {InputType::ArrowUp, '\0'};

            case 'B':
                return {InputType::ArrowDown, '\0'};

            case 'C':
                return {InputType::ArrowRight, '\0'};

            case 'D':
                return {InputType::ArrowLeft, '\0'};

            case 'H':
                return {InputType::Home, '\0'};

            case 'F':
                return {InputType::End, '\0'};

            default:
                break;
        }

        return {};
    }

    return {
        InputType::Character,
        c
    };
}

std::string Input::readLine(const std::string& prompt) {
    std::string result;

    std::printf("%s", prompt.c_str());
    std::fflush(stdout);

    while (true) {
        const Key key = readKey();

        switch (key.type) {
            case KeyType::Character:
                result += key.character;
                std::printf("%c", key.character);
                std::fflush(stdout);
                break;

            case KeyType::Backspace:
                if (!result.empty()) {
                    result.pop_back();

                    std::printf("\b \b");
                    std::fflush(stdout);
                }
                break;

            case KeyType::Enter:
                std::printf("\n");
                std::fflush(stdout);
                return result;

            case KeyType::Escape:
                std::printf("\n");
                std::fflush(stdout);
                return {};

            default:
                break;
        }
    }
}

#endif
