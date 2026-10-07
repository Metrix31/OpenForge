#pragma once

#include <string>
#include <deque>

class Terminal;

enum class InputType {
    Character,
    Enter,
    Backspace,
    Delete,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Home,
    End,
    Escape,
    CtrlS,
    CtrlO,
    CtrlN,
    CtrlF,
    CtrlQ,
    Unknown
};

// Compatibility with the existing Editor API.
using KeyType = InputType;

struct InputEvent {
    InputType type = InputType::Unknown;
    char character = '\0';
};

// Compatibility with the existing Editor API.
using Key = InputEvent;

class Input {
public:
    explicit Input(Terminal& terminal);

    InputEvent read();
    Key readKey();

    std::string readLine(const std::string& prompt);

private:
    Terminal& terminal_;

    // Used for UTF-8 bytes produced from Windows Unicode input.
    std::deque<char> pendingCharacters_;

#ifdef _WIN32
    InputEvent readWindows();
#else
    InputEvent readLinux();
#endif
};