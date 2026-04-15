path = r'd:\backup\Pipe3d back java\src\components\Dashboard.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

insert_after = "    console.error('Delete error:', err);\r\n      alert('Error connecting to server');\r\n    }\r\n  };\r\n"
new_code = """    console.error('Delete error:', err);
      alert('Error connecting to server');
    }
  };

  const [isBOMLoading, setIsBOMLoading] = React.useState(false);

  const openBOM = async (project) => {
    setSelectedBOM(project);
    setIsBOMLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      const full = await res.json();
      setSelectedBOM(full);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch full project for BOM:', err);
    } finally {
      setIsBOMLoading(false);
    }
  };

"""

# Normalize line endings first
content_lf = content.replace('\r\n', '\n')

old_segment = "    console.error('Delete error:', err);\n      alert('Error connecting to server');\n    }\n  };\n"
new_segment = """    console.error('Delete error:', err);
      alert('Error connecting to server');
    }
  };

  const [isBOMLoading, setIsBOMLoading] = React.useState(false);

  const openBOM = async (project) => {
    setSelectedBOM(project);
    setIsBOMLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      const full = await res.json();
      setSelectedBOM(full);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch full project for BOM:', err);
    } finally {
      setIsBOMLoading(false);
    }
  };

"""

if old_segment in content_lf:
    result = content_lf.replace(old_segment, new_segment, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(result)
    print('Done! openBOM function inserted.')
else:
    print('Segment not found!')
    # Debug
    idx = content_lf.find("Delete error")
    print(f"Found Delete error at index {idx}")
    print(repr(content_lf[idx-50:idx+200]))
