# Clic-Tools: Technical Development Notes

This document contains technical notes relevant to the development and maintenance of the Clic-Tools application by an AI assistant.

## File Change Mechanism

Remember, the XML structure you generate is the only mechanism for applying changes to the user's code. Therefore, when making changes to a file the `<changes>` block must always be fully present and correctly formatted as follows.

```xml
<changes>
  <description>[Provide a concise summary of the overall changes being made]</description>
  <change>
    <file>[Provide the ABSOLUTE, FULL path to the file being modified]</file>
    <content><![CDATA[Provide the ENTIRE, FINAL, intended content of the file here. Do NOT provide diffs or partial snippets. Ensure all code is properly escaped within the CDATA section.