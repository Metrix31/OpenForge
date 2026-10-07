#include "Cursor.hpp"
#include "Document.hpp"

#include <algorithm>

std::size_t Cursor::row() const noexcept { return row_; }
std::size_t Cursor::column() const noexcept { return column_; }

void Cursor::setPosition(std::size_t row, std::size_t column, const Document& document) {
    if (document.lineCount() == 0) { row_ = column_ = preferredColumn_ = 0; return; }
    row_ = std::min(row, document.lineCount() - 1);
    column_ = std::min(column, document.line(row_).size());
    preferredColumn_ = column_;
}

void Cursor::left(const Document& document) {
    if (column_ > 0) { --column_; preferredColumn_ = column_; return; }
    if (row_ > 0) { --row_; column_ = document.line(row_).size(); preferredColumn_ = column_; }
}

void Cursor::right(const Document& document) {
    if (column_ < document.line(row_).size()) { ++column_; preferredColumn_ = column_; return; }
    if (row_ + 1 < document.lineCount()) { ++row_; column_ = 0; preferredColumn_ = 0; }
}

void Cursor::up(const Document& document) {
    if (row_ == 0) return;
    --row_;
    column_ = std::min(preferredColumn_, document.line(row_).size());
}

void Cursor::down(const Document& document) {
    if (row_ + 1 >= document.lineCount()) return;
    ++row_;
    column_ = std::min(preferredColumn_, document.line(row_).size());
}

void Cursor::home() noexcept { column_ = 0; preferredColumn_ = 0; }
void Cursor::end(const Document& document) { column_ = document.line(row_).size(); preferredColumn_ = column_; }
