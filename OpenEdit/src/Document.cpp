#include "Document.hpp"

#include <algorithm>
#include <stdexcept>

Document::Document() : lines_{""} {}

const std::vector<std::string>& Document::lines() const noexcept { return lines_; }
std::vector<std::string>& Document::lines() noexcept { return lines_; }
std::size_t Document::lineCount() const noexcept { return lines_.size(); }

const std::string& Document::line(std::size_t row) const {
    if (row >= lines_.size()) throw std::out_of_range("document row");
    return lines_[row];
}

std::string& Document::line(std::size_t row) {
    if (row >= lines_.size()) throw std::out_of_range("document row");
    return lines_[row];
}

void Document::insertChar(std::size_t row, std::size_t column, char ch) {
    if (row >= lines_.size()) throw std::out_of_range("document row");
    auto& current = lines_[row];
    column = std::min(column, current.size());
    current.insert(current.begin() + static_cast<std::ptrdiff_t>(column), ch);
}

void Document::eraseChar(std::size_t row, std::size_t column) {
    if (row >= lines_.size()) throw std::out_of_range("document row");
    auto& current = lines_[row];
    if (column < current.size()) current.erase(current.begin() + static_cast<std::ptrdiff_t>(column));
}

void Document::insertNewline(std::size_t row, std::size_t column) {
    if (row >= lines_.size()) throw std::out_of_range("document row");
    auto& current = lines_[row];
    column = std::min(column, current.size());
    std::string tail = current.substr(column);
    current.erase(column);
    lines_.insert(lines_.begin() + static_cast<std::ptrdiff_t>(row + 1), std::move(tail));
}

void Document::backspace(std::size_t row, std::size_t column) {
    if (row >= lines_.size()) throw std::out_of_range("document row");
    if (column > 0) {
        eraseChar(row, column - 1);
        return;
    }
    if (row == 0) return;
    const auto previousLength = lines_[row - 1].size();
    lines_[row - 1] += lines_[row];
    lines_.erase(lines_.begin() + static_cast<std::ptrdiff_t>(row));
    (void)previousLength;
}

void Document::setLines(std::vector<std::string> lines) {
    if (lines.empty()) lines.emplace_back();
    lines_ = std::move(lines);
}

void Document::clear() { lines_ = {""}; }
