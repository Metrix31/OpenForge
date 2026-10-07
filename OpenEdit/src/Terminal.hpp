#pragma once

#include <utility>

class Terminal {
public:
    Terminal();
    ~Terminal();

    Terminal(const Terminal&) = delete;
    Terminal& operator=(const Terminal&) = delete;

    void enableRawMode();
    void disableRawMode();

    // Current API
    void clear();
    void hideCursor();
    void showCursor();
    void moveCursor(int row, int column);
    std::pair<int, int> getSize() const;

    // Compatibility with existing Editor/Renderer code.
    void restore();
    void clearScreen();
    std::pair<int, int> size() const;

private:
#ifdef _WIN32
    void* inputHandle_;
    void* outputHandle_;

    unsigned long originalInputMode_;
    unsigned long originalOutputMode_;

    bool rawModeEnabled_;
#else
    struct termios* originalTermios_;
    bool rawModeEnabled_;
#endif
};