from pathlib import Path
from .document import Document
from .cursor import Cursor
from .terminal import Terminal
from .input import *
from .search import find_next
class Editor:
 def __init__(self,d): self.d=d; self.c=Cursor(); self.t=Terminal(); self.i=Input(); self.runflag=True; self.status=''
 def save(self,path=None):
  p=Path(path or self.d.path).expanduser() if (path or self.d.path) else None
  if not p:return self.save_as()
  try:p.write_text(self.d.text(),encoding='utf-8',newline=''); self.d.path=p; self.d.modified=False; self.status=f'Saved: {p}'; return True
  except OSError as e:self.status=f'Error: {e}'; return False
 def prompt(self,msg):
  self.t.write('\n'+msg); return input()
 def confirm(self,msg): return self.prompt(msg).strip().lower() in ('y','yes')
 def guard(self):
  if not self.d.modified:return True
  a=self.prompt('Unsaved changes. Save before continuing? [Y/n] ').strip().lower()
  if a in ('n','no'):return True
  return self.save()
 def save_as(self): return self.save(self.prompt('Save as: ').strip())
 def open(self):
  if not self.guard():return
  p=self.prompt('Open file: ').strip()
  if not p:return
  p=Path(p).expanduser()
  try:self.d=Document.load(p) if p.exists() else Document(path=p); self.c=Cursor(); self.status=f'Opened: {p}'
  except (OSError,UnicodeDecodeError) as e:self.status=f'Error: {e}'
 def new(self):
  if self.guard(): self.d=Document(); self.c=Cursor(); self.status='New document.'
 def find(self):
  q=self.prompt('Find: '); x=find_next(self.d,q,self.c.row,self.c.col+1)
  if x:self.c.row,self.c.col=x; self.status=f'Found: {q}'
  else:self.status=f'Not found: {q}'
 def draw(self):
  w,h=self.t.size(); vh=max(1,h-3); start=max(0,min(self.c.row-vh+1,self.c.row)); self.t.write('\x1b[2J\x1b[H'); title=self.d.path.name if self.d.path else '[No Name]'; self.t.write(f' OpenEdit - {title}'+(' *' if self.d.modified else '')+'\n');
  for n in range(vh): self.t.write((self.d.lines[start+n] if start+n<len(self.d.lines) else '')[:w]+'\x1b[K\n')
  self.t.write(f' Line {self.c.row+1}, Col {self.c.col+1}'+(' | Modified' if self.d.modified else '')+(f' | {self.status}' if self.status else '')+'\x1b[K\n')
  self.t.write(' ^S Save  ^O Open  ^N New  ^F Find  ^Q Quit\x1b[K'); self.t.write(f'\x1b[{self.c.row-start+2};{min(self.c.col,w-1)+1}H'); self.status=''
 def key(self,k):
  if isinstance(k,tuple): self.c.row,self.c.col=self.d.insert(self.c.row,self.c.col,k[1]); self.c.preferred=self.c.col
  elif k==LEFT:self.c.left(self.d)
  elif k==RIGHT:self.c.right(self.d)
  elif k==UP:self.c.up(self.d)
  elif k==DOWN:self.c.down(self.d)
  elif k==HOME:self.c.home(self.d)
  elif k==END:self.c.end(self.d)
  elif k==ENTER:self.c.row,self.c.col=self.d.enter(self.c.row,self.c.col); self.c.preferred=0
  elif k==BACKSPACE:self.c.row,self.c.col=self.d.backspace(self.c.row,self.c.col)
  elif k==DELETE:self.d.delete(self.c.row,self.c.col)
  elif k=='CTRL_S':self.save()
  elif k=='CTRL_O':self.open()
  elif k=='CTRL_N':self.new()
  elif k=='CTRL_F':self.find()
  elif k=='CTRL_Q':self.runflag=False
 def run(self):
  try:
   with self.t.raw():
    while self.runflag:self.draw(); self.key(self.i.read())
  finally:self.t.write('\x1b[?25h\x1b[2J\x1b[H')
