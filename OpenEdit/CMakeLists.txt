cmake_minimum_required(VERSION 3.16)
project(OpenEdit VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(openedit
    src/main.cpp
    src/Editor.cpp
    src/Document.cpp
    src/Cursor.cpp
    src/Terminal.cpp
    src/Input.cpp
    src/Renderer.cpp
    src/FileManager.cpp
)

target_include_directories(openedit PRIVATE src)

if(MSVC)
    target_compile_options(openedit PRIVATE /W4)
else()
    target_compile_options(openedit PRIVATE -Wall -Wextra -Wpedantic)
endif()

include(CTest)
if(BUILD_TESTING)
    add_executable(openedit_tests
        tests/test_document.cpp
        src/Document.cpp
        src/FileManager.cpp
    )
    target_include_directories(openedit_tests PRIVATE src)
    if(MSVC)
        target_compile_options(openedit_tests PRIVATE /W4)
    else()
        target_compile_options(openedit_tests PRIVATE -Wall -Wextra -Wpedantic)
    endif()
    add_test(NAME openedit_tests COMMAND openedit_tests)
endif()
