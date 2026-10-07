#pragma once

#include <string>
#include <vector>

class Document {
public:
    Document();

    const std::vector<std::string>& lines() const noexcept;
    std::vector<std::string>& lines() noexcept;

    std::size_t lineCount() const noexcept;
    const std::string& line(std::size_t row) const;
    std::string& line(std::size_t row);

    void insertChar(std::size_t row, std::size_t column, char ch);
    void eraseChar(std::size_t row, std::size_t column);
    void insertNewline(std::size_t row, std::size_t column);
    void backspace(std::size_t row, std::size_t column);

    void setLines(std::vector<std::string> lines);
    void clear();

private:
    std::vector<std::string> lines_;
};
