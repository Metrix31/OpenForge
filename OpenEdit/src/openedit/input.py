import os
import sys

LEFT, RIGHT, UP, DOWN, HOME, END, DELETE, ENTER, BACKSPACE = (
    'LEFT RIGHT UP DOWN HOME END DELETE ENTER BACKSPACE'.split()
)


class Input:
    def read(self):
        if os.name == 'nt':
            return self.win()

        ch = sys.stdin.read(1)

        ctrl = {
            '\x13': 'CTRL_S',  # Ctrl+S
            '\x0f': 'CTRL_O',  # Ctrl+O
            '\x0e': 'CTRL_N',  # Ctrl+N
            '\x06': 'CTRL_F',  # Ctrl+F
            '\x11': 'CTRL_Q',  # Ctrl+Q
        }

        if ch in ctrl:
            return ctrl[ch]

        if ch in '\r\n':
            return ENTER

        if ch in '\x7f\x08':
            return BACKSPACE

        if ch == '\x1b':
            seq = sys.stdin.read(2)

            m = {
                '[A': UP,
                '[B': DOWN,
                '[C': RIGHT,
                '[D': LEFT,
                '[H': HOME,
                '[F': END,
            }

            if seq in m:
                return m[seq]

            if seq == '[3':
                if sys.stdin.read(1) == '~':
                    return DELETE

            return 'ESC'

        return ('CHAR', ch)

    def win(self):
        import msvcrt

        ch = msvcrt.getwch()

        ctrl = {
            '\x13': 'CTRL_S',  # Ctrl+S
            '\x0f': 'CTRL_O',  # Ctrl+O
            '\x0e': 'CTRL_N',  # Ctrl+N
            '\x06': 'CTRL_F',  # Ctrl+F
            '\x11': 'CTRL_Q',  # Ctrl+Q
        }

        if ch in ctrl:
            return ctrl[ch]

        if ch in '\r\n':
            return ENTER

        if ch in '\x08\x7f':
            return BACKSPACE

        if ch in '\x00\xe0':
            m = {
                'H': UP,
                'P': DOWN,
                'K': LEFT,
                'M': RIGHT,
                'G': HOME,
                'O': END,
                'S': DELETE,
            }

            return m.get(msvcrt.getwch(), 'ESC')

        return ('CHAR', ch)
