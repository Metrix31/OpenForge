#include "FileManager.hpp"

#include <fstream>
#include <sstream>
#include <stdexcept>

void FileManager::load(const std::filesystem::path& path, Document& document) {
    if (!std::filesystem::exists(path)) throw std::runtime_error("File does not exist.");
    if (std::filesystem::is_directory(path)) throw std::runtime_error("Path is a directory, not a file.");

    std::ifstream input(path, std::ios::binary);
    if (!input) throw std::runtime_error("Unable to open file.");

    std::vector<std::string> lines;
    std::string line;
    while (std::getline(input, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        lines.push_back(std::move(line));
    }
    if (input.bad()) throw std::runtime_error("Error while reading file.");
    if (lines.empty()) lines.emplace_back();
    document.setLines(std::move(lines));
}

void FileManager::save(const std::filesystem::path& path, const Document& document) {
    if (path.empty()) throw std::runtime_error("Invalid empty file path.");
    if (std::filesystem::exists(path) && std::filesystem::is_directory(path)) throw std::runtime_error("Path is a directory, not a file.");

    const auto temp = path.string() + ".openedit-tmp";
    {
        std::ofstream output(temp, std::ios::binary | std::ios::trunc);
        if (!output) throw std::runtime_error("Unable to create temporary save file (permission denied or invalid path).");
        for (std::size_t i = 0; i < document.lineCount(); ++i) {
            output.write(document.line(i).data(), static_cast<std::streamsize>(document.line(i).size()));
            if (i + 1 < document.lineCount()) output.put('\n');
        }
        output.flush();
        if (!output) {
            output.close();
            std::error_code ec; std::filesystem::remove(temp, ec);
            throw std::runtime_error("Unable to write file.");
        }
    }

    std::error_code ec;
    std::filesystem::rename(temp, path, ec);
    if (ec) {
        std::filesystem::remove(path, ec);
        ec.clear();
        std::filesystem::rename(temp, path, ec);
    }
    if (ec) {
        std::filesystem::remove(temp, ec);
        throw std::runtime_error("Unable to replace target file: " + ec.message());
    }
}
