const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const result = document.getElementById('result');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFile(fileInput.files[0]); });

function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ttl', document.getElementById('ttl').value);
  const maxDl = document.getElementById('maxDownloads').value;
  if (maxDl) formData.append('maxDownloads', maxDl);
  const pw = document.getElementById('password').value;
  if (pw) formData.append('password', pw);

  const xhr = new XMLHttpRequest();
  progress.style.display = 'block';
  result.style.display = 'none';

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = `Uploading... ${pct}%`;
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      progress.style.display = 'none';
      result.style.display = 'block';
      const link = document.getElementById('shareLink');
      link.href = data.url;
      link.textContent = data.url;
      document.getElementById('expiresAt').textContent = 'Expires: ' + new Date(data.expiresAt).toLocaleString();
    } else {
      progressText.textContent = 'Upload failed: ' + (JSON.parse(xhr.responseText).error || 'Unknown error');
    }
  };

  xhr.onerror = () => { progressText.textContent = 'Upload failed — network error'; };
  xhr.open('POST', '/api/upload');
  xhr.send(formData);
}
