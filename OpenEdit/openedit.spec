from PyInstaller.utils.hooks import collect_submodules
hiddenimports = collect_submodules('src.openedit')
a = Analysis(['openedit.py'], pathex=['.'], binaries=[], datas=[], hiddenimports=hiddenimports, hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=[])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name='openedit', console=True)
