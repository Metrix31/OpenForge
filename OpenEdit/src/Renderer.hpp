#pragma once

#include "Cursor.hpp"
#include "Document.hpp"
#include "Terminal.hpp"
#include <filesystem>
#include <string>

class Renderer {
public:
    explicit Renderer(Terminal& terminal);
    void draw(const Document& document, const Cursor& cursor,
              const std::filesystem::path& path, bool modified,
              std::size_t scrollRow, std::size_t scrollColumn,
              const std::string& status);

private:
    Terminal& terminal_;
    static std::string displayName(const std::filesystem::path& path);
};
