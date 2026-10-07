#pragma once

#include <cstddef>

class Document;

class Cursor {
public:
    std::size_t row() const noexcept;
    std::size_t column() const noexcept;

    void setPosition(std::size_t row, std::size_t column, const Document& document);
    void left(const Document& document);
    void right(const Document& document);
    void up(const Document& document);
    void down(const Document& document);
    void home() noexcept;
    void end(const Document& document);

private:
    std::size_t row_{0};
    std::size_t column_{0};
    std::size_t preferredColumn_{0};
};
