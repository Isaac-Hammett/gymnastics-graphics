window.BlockHeaderBar = {
  themeVars: ['--meet-header-bg', '--meet-header-text', '--meet-logo-url', '--meet-logo-size'],

  sampleData: {
    title: 'VAULT',
    logo: 'https://media.virti.us/upload/images/team/placeholder.png'
  },

  render: function(container, data) {
    var title = (data && data.title) || 'TITLE';
    var logoUrl = (data && data.logo) || '';

    var html = '<span class="hb-title">' + _escapeHtml(title) + '</span>';

    if (logoUrl) {
      html += '<img class="hb-logo" src="' + _escapeHtml(logoUrl) + '" alt="" />';
    }

    container.innerHTML = html;
  },

  ready: function() {
    return Promise.resolve();
  }
};

function _escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
