import zipfile
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\ebrin\Downloads\Mobile Devices\Trainee interview.docx"
z = zipfile.ZipFile(path)
xml = z.read("word/document.xml").decode("utf-8")
text = re.sub(r"</w:p>", "\n", xml)
text = re.sub(r"<[^>]+>", "", text)
for a, b in [("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")]:
    text = text.replace(a, b)
text = re.sub(r"[ \t]+", " ", text)
text = re.sub(r"\n\s*\n+", "\n\n", text)
print(text.strip())
