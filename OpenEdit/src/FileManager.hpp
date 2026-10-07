#pragma once

#include "Document.hpp"
#include <filesystem>
#include <string>

class FileManager {
public:
    static void load(const std::filesystem::path& path, Document& document);
    static void save(const std::filesystem::path& path, const Document& document);
};
