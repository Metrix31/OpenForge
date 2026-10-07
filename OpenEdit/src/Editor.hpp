#pragma once

#include "Cursor.hpp"
#include "Document.hpp"
#include "Input.hpp"
#include "Renderer.hpp"
#include "Terminal.hpp"
#include <filesystem>
#include <string>

class Editor {
public:
    Editor();
    int run(const std::filesystem::path& initialPath = {});

private:
    Terminal terminal_;
    Input input_;
    Renderer renderer_;
    Document document_;
    Cursor cursor_;
    std::filesystem::path path_;
    bool modified_{false};
    std::size_t scrollRow_{0};
    std::size_t scrollColumn_{0};
    std::string status_;

    void open(const std::filesystem::path& path);
    bool save();
    bool saveAs();
    bool newDocument();
    bool quit();
    void find();
    void handleKey(const Key& key);
    void insertCharacter(char c);
    void deleteForward();
    void adjustViewport();
    void message(const std::string& text);
    std::string prompt(const std::string& text);
};
