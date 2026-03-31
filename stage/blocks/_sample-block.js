window.BlockSampleBlock = {
  sampleData: {
    title: "Sample Block",
    items: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"]
  },
  render(container, data) {
    container.innerHTML = `
      <div class="sample-title">${data.title}</div>
      <ul class="sample-list">
        ${data.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    `;
  },
  ready() { return Promise.resolve(); }
};
