"use strict";

function editNotes(id, name) {
  // elements
  const notesLegend = byId("notesLegend");
  const notesName = byId("notesName");
  const notesSelect = byId("notesSelect");
  const notesPin = byId("notesPin");

  // update list of objects
  notesSelect.options.length = 0;
  notes.forEach(({id}) => notesSelect.options.add(new Option(id, id)));

  // update pin notes icon
  const notesArePinned = options.pinNotes;
  if (notesArePinned) notesPin.classList.add("pressed");
  else notesPin.classList.remove("pressed");

  // select an object
  if (notes.length || id) {
    if (!id) id = notes[0].id;
    let note = notes.find(note => note.id === id);
    if (!note) {
      if (!name) name = id;
      note = {id, name, legend: ""};
      notes.push(note);
      notesSelect.options.add(new Option(id, id));
    }

    notesSelect.value = id;
    notesName.value = note.name;
    notesLegend.innerHTML = note.legend;
    initEditor();
    updateNotesBox(note);
  } else {
    // if notes array is empty
    notesName.value = "";
    notesLegend.innerHTML = "未添加注释。点击一个元素(例如标签或标记)并添加一个自由文本注释";
  }

  $("#notesEditor").dialog({
    title: "笔记编辑器",
    width: svgHeight * 0.8,
    height: svgHeight * 0.75,
    position: {my: "center", at: "center", of: "svg"},
    close: removeEditor
  });

  if (modules.editNotes) return;
  modules.editNotes = true;

  // add listeners
  byId("notesSelect").addEventListener("change", changeElement);
  byId("notesName").addEventListener("input", changeName);
  byId("notesLegend").addEventListener("blur", updateLegend);
  byId("notesPin").addEventListener("click", toggleNotesPin);
  byId("notesFocus").addEventListener("click", validateHighlightElement);
  byId("notesGenerateWithAi").addEventListener("click", openAiGenerator);
  byId("notesDownload").addEventListener("click", downloadLegends);
  byId("notesUpload").addEventListener("click", () => legendsToLoad.click());
  byId("legendsToLoad").addEventListener("change", function () {
    uploadFile(this, uploadLegends);
  });
  byId("notesRemove").addEventListener("click", triggerNotesRemove);

  async function initEditor() {
    if (!window.tinymce) {
      const url = "https://www.8desk.top/libs/tinymce/tinymce.min.js";
      try {
        await import(url);
      } catch (error) {
        // error may be caused by failed request being cached, try again with random hash
        try {
          const hash = Math.random().toString(36).substring(2, 15);
          await import(`${url}#${hash}`);
        } catch (error) {
          console.error(error);
        }
      }
    }

    if (window.tinymce) {
      window.tinymce._setBaseUrl("https://www.8desk.top/libs/tinymce");
      tinymce.init({
        license_key: "gpl",
        selector: "#notesLegend",
        height: "90%",
        menubar: false,
        plugins: `autolink lists link charmap code fullscreen image link media table wordcount`,
        toolbar: `code | undo redo | removeformat | bold italic strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | fontselect fontsizeselect | blockquote hr charmap | print fullscreen`,
        media_alt_source: false,
        media_poster: false,
        browser_spellcheck: true,
        contextmenu: false,
        setup: editor => {
          editor.on("Change", updateLegend);
        }
      });
    }
  }

  function updateLegend() {
    const note = notes.find(note => note.id === notesSelect.value);
    if (!note) return tip("找不到笔记元素", true, "error", 4000);

    const isTinyEditorActive = window.tinymce?.activeEditor;
    note.legend = isTinyEditorActive ? tinymce.activeEditor.getContent() : notesLegend.innerHTML;
    updateNotesBox(note);
  }

  function updateNotesBox(note) {
    byId("notesHeader").innerHTML = note.name;
    byId("notesBody").innerHTML = note.legend;
  }

  function changeElement() {
    const note = notes.find(note => note.id === this.value);
    if (!note) return tip("找不到笔记元素", true, "error", 4000);

    notesName.value = note.name;
    notesLegend.innerHTML = note.legend;
    updateNotesBox(note);

    if (window.tinymce) tinymce.activeEditor.setContent(note.legend);
  }

  function changeName() {
    const note = notes.find(note => note.id === notesSelect.value);
    if (!note) return tip("找不到笔记元素", true, "error", 4000);

    note.name = this.value;
  }

  function validateHighlightElement() {
    const element = byId(notesSelect.value);
    if (element) return highlightElement(element, 3);

    confirmationDialog({
      title: "找不到元素",
      message: "找不到笔记元素，你要删除笔记吗?",
      confirm: "删除",
      cancel: "保持",
      onConfirm: removeLegend
    });
  }

  function openAiGenerator() {
    const note = notes.find(note => note.id === notesSelect.value);

    let prompt = `Write in Chinese. Respond with description. Use simple dry language. Invent facts, names and details.  Split to paragraphs and format to HTML. Remove h tags, remove markdown.`;
    if (note?.name) prompt += ` Name: ${note.name}.`;
    if (note?.legend) prompt += ` Data: ${note.legend}`;

    const onApply = result => {
      notesLegend.innerHTML = result;
      if (note) {
        note.legend = result;
        updateNotesBox(note);
        if (window.tinymce) tinymce.activeEditor.setContent(note.legend);
      }
    };

    generateWithAi(prompt, onApply);
  }

  function downloadLegends() {
    const notesData = JSON.stringify(notes);
    const name = getFileName("Notes") + ".txt";
    downloadFile(notesData, name);
  }

  function uploadLegends(dataLoaded) {
    if (!dataLoaded) return tip("无法加载文件。请检查数据格式", false, "error");
    notes = JSON.parse(dataLoaded);
    notesSelect.options.length = 0;
    editNotes(notes[0].id, notes[0].name);
  }

  function triggerNotesRemove() {
    function removeLegend() {
      notes = notes.filter(({id}) => id !== notesSelect.value);

      if (!notes.length) {
        $("#notesEditor").dialog("close");
        return;
      }

      removeEditor();
      editNotes(notes[0].id, notes[0].name);
    }

    confirmationDialog({
      title: "删除笔记",
      message: "确实要删除选中的笔记吗? 无法撤消此操作",
      confirm: "删除",
      onConfirm: removeLegend
    });
  }

  function toggleNotesPin() {
    options.pinNotes = !options.pinNotes;
    this.classList.toggle("pressed");
  }

  function removeEditor() {
    if (window.tinymce) tinymce.remove();
  }
}
