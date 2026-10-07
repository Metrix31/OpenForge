import argparse
from pathlib import Path
from . import __version__
from .document import Document
from .editor import Editor
def main(argv=None):
 p=argparse.ArgumentParser(prog='openedit',description='A lightweight cross-platform terminal text editor.')
 p.add_argument('file',nargs='?'); p.add_argument('--version',action='version',version=f'%(prog)s {__version__}')
 a=p.parse_args(argv); d=Document()
 if a.file:
  q=Path(a.file).expanduser()
  if q.exists():
   try:d=Document.load(q)
   except (OSError,UnicodeDecodeError) as e:p.error(str(e))
  else:d=Document(path=q)
 Editor(d).run(); return 0
if __name__=='__main__':raise SystemExit(main())
