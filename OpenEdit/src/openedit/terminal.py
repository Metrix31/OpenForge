import os,sys,shutil
from contextlib import contextmanager
class Terminal:
    def size(self):
        s=shutil.get_terminal_size((80,24)); return s.columns,s.lines
    def write(self,s): sys.stdout.write(s); sys.stdout.flush()
    @contextmanager
    def raw(self):
        if os.name=='nt': yield; return
        import termios,tty
        fd=sys.stdin.fileno(); old=termios.tcgetattr(fd)
        try: tty.setraw(fd); yield
        finally: termios.tcsetattr(fd,termios.TCSADRAIN,old)
