#include "Document.hpp"
#include "FileManager.hpp"

#include <cassert>
#include <filesystem>
#include <fstream>
#include <iostream>

int main() {
    Document d;
    assert(d.lineCount() == 1);
    d.insertChar(0, 0, 'a');
    d.insertChar(0, 1, 'b');
    assert(d.line(0) == "ab");
    d.insertNewline(0, 1);
    assert(d.lineCount() == 2);
    assert(d.line(0) == "a");
    assert(d.line(1) == "b");
    d.backspace(1, 0);
    assert(d.lineCount() == 1 && d.line(0) == "ab");

    const auto path = std::filesystem::temp_directory_path() / "openedit-test.txt";
    d.insertNewline(0, 2);
    d.line(1) = "Grüße";
    FileManager::save(path, d);
    Document loaded;
    FileManager::load(path, loaded);
    assert(loaded.lineCount() == 2);
    assert(loaded.line(0) == "ab");
    assert(loaded.line(1) == "Grüße");
    std::filesystem::remove(path);

    std::cout << "All OpenEdit tests passed.\n";
    return 0;
}
