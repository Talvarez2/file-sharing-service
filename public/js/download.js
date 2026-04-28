const code = window.location.pathname.split('/').pop();
const fileCard = document.getElementById('fileCard');
const errorMsg = document.getElementById('errorMsg');

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

fetch(`/api/files/${code}`)
  .then(r => { if (!r.ok) throw r; return r.json(); })
  .then(file => {
    document.getElementById('fileName').textContent = file.original_name;
    document.getElementById('fileMeta').textContent =
      `${formatSize(file.size)} · Expires ${new Date(file.expires_at).toLocaleString()}` +
      (file.max_downloads ? ` · ${file.download_count}/${file.max_downloads} downloads` : '');

    // Icon based on mime type
    const icon = document.getElementById('fileIcon');
    if (file.mime_type.startsWith('image/')) icon.textContent = '🖼️';
    else if (file.mime_type.startsWith('video/')) icon.textContent = '🎬';
    else if (file.mime_type.startsWith('audio/')) icon.textContent = '🎵';
    else if (file.mime_type.includes('pdf')) icon.textContent = '📕';
    else if (file.mime_type.includes('zip') || file.mime_type.includes('tar')) icon.textContent = '📦';

    if (file.hasPassword) {
      document.getElementById('passwordSection').style.display = 'block';
    }

    // Load preview for images and text
    if (!file.hasPassword) {
      const preview = document.getElementById('previewContainer');
      if (file.mime_type.startsWith('image/')) {
        preview.innerHTML = `<img src="/api/preview/${code}" alt="Preview">`;
      } else if (file.mime_type.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript'].includes(file.mime_type)) {
        fetch(`/api/preview/${code}`).then(r => r.json()).then(d => {
          if (d.type === 'text') preview.innerHTML = `<pre>${d.content.replace(/</g, '&lt;')}</pre>`;
        });
      }
    }

    document.getElementById('downloadBtn').onclick = () => {
      const pw = document.getElementById('dlPassword').value;
      const params = new URLSearchParams({ download: '1' });
      if (pw) params.set('password', pw);
      window.location.href = `/d/${code}?${params}`;
    };
  })
  .catch(async err => {
    const body = await err.json().catch(() => ({}));
    document.getElementById('fileName').textContent = 'File not available';
    document.getElementById('fileIcon').textContent = '❌';
    errorMsg.textContent = body.error || 'File not found or expired';
    errorMsg.style.display = 'block';
    document.getElementById('downloadBtn').style.display = 'none';
  });
