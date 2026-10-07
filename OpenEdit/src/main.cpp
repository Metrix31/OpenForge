#include "Editor.hpp"

#include <filesystem>
#include <iostream>

int main(int argc, char* argv[]) {
    if (argc > 2) {
        std::cerr << "Usage: openedit [file]\n";
        return 2;
    }
    const std::filesystem::path path = argc == 2 ? argv[1] : std::filesystem::path{};
    Editor editor;
    return editor.run(path);
}
