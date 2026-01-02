document.addEventListener('DOMContentLoaded', () => {
    
    // --- Mobile Menu Toggle ---
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if(menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });

        // Close menu when clicking a link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // --- FAQ Accordion ---
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            // Close others
            faqItems.forEach(other => {
                if(other !== item) other.classList.remove('active');
            });
            // Toggle current
            item.classList.toggle('active');
        });
    });

    // --- Scroll Reveal Animation ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.card, .gallery-item, .section-header').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });

    // --- Glitch Effect for Title ---
    const glitchText = document.querySelector('.glitch-text');
    if (glitchText) {
        setInterval(() => {
            glitchText.style.textShadow = `
                ${Math.random() * 5 - 2.5}px ${Math.random() * 5 - 2.5}px 0 #FF0000,
                ${Math.random() * 5 - 2.5}px ${Math.random() * 5 - 2.5}px 0 #0000FF
            `;
            setTimeout(() => {
                glitchText.style.textShadow = 'none';
            }, 100);
        }, 3000);
    }

    // ==========================================
    // 🔴 BACKEND WIRING STARTS HERE
    // ==========================================

    // --- Global State ---
    let currentUploadedUrl = null;
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const previewImage = document.getElementById('preview-image');
    const uploadPlaceholder = document.querySelector('.upload-placeholder');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultContainer = document.getElementById('result-container');
    const resultImage = document.getElementById('result-image');
    const resultPlaceholder = document.getElementById('result-placeholder');
    const loadingState = document.getElementById('loading-state');
    const downloadBtn = document.getElementById('download-btn');

    // Create status text element if missing (required for helper functions)
    let statusText = document.getElementById('status-text');
    if (!statusText && loadingState) {
        statusText = document.createElement('p');
        statusText.id = 'status-text';
        statusText.className = 'status-text mt-4 text-center font-mono text-sm';
        statusText.style.color = 'var(--foreground)';
        loadingState.appendChild(statusText);
    }

    // --- Helper Functions ---

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Upload file to CDN storage
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        // Filename is just nanoid.extension
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL from API
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        console.log('Got signed URL');
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = 'https://contents.maxstudio.ai/' + fileName;
        console.log('Uploaded to:', downloadUrl);
        return downloadUrl;
    }

    // Submit generation job
    async function submitImageGenJob(imageUrl) {
        const endpoint = 'https://api.chromastudio.ai/image-gen';
        
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0'
        };

        const body = {
            model: 'image-effects',
            toolType: 'image-effects',
            effectId: 'mugshot',
            imageUrl: imageUrl,
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        console.log('Job submitted:', data.jobId, 'Status:', data.status);
        return data;
    }

    // Poll job status until completed or failed
    async function pollJobStatus(jobId) {
        const baseUrl = 'https://api.chromastudio.ai/image-gen';
        const POLL_INTERVAL = 2000;
        const MAX_POLLS = 60;
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            // Update UI with progress
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out after ' + MAX_POLLS + ' polls');
    }

    // UI Helpers
    function showLoading() {
        if (loadingState) {
            loadingState.classList.remove('hidden');
            loadingState.style.display = 'flex';
        }
        if (resultContainer) resultContainer.classList.add('loading');
        // Hide previous results while loading
        if (resultImage) resultImage.classList.add('hidden');
        if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
        const video = document.getElementById('result-video');
        if (video) video.classList.add('hidden');
    }

    function hideLoading() {
        if (loadingState) {
            loadingState.classList.add('hidden');
            loadingState.style.display = 'none';
        }
        if (resultContainer) resultContainer.classList.remove('loading');
    }

    function updateStatus(text) {
        if (statusText) statusText.textContent = text;
        
        if (generateBtn) {
            if (text.includes('PROCESSING') || text.includes('UPLOADING') || text.includes('SUBMITTING')) {
                generateBtn.disabled = true;
                generateBtn.textContent = text;
            } else if (text === 'READY') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'GENERATE MUGSHOT';
            } else if (text === 'COMPLETE') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'GENERATE AGAIN';
            }
        }
    }

    function showError(msg) {
        alert('Error: ' + msg);
        updateStatus('ERROR');
    }

    function showPreview(url) {
        if (previewImage) {
            previewImage.src = url;
            previewImage.classList.remove('hidden');
        }
        if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
        if (dropZone) dropZone.classList.add('has-file');
    }

    function showResultMedia(url) {
        if (!resultContainer) return;

        // Hide placeholder
        if (resultPlaceholder) resultPlaceholder.classList.add('hidden');

        const isVideo = url.toLowerCase().match(/\.(mp4|webm)(\?.*)?$/i);

        if (isVideo) {
            // Hide image
            if (resultImage) resultImage.classList.add('hidden');
            
            // Show/Create video
            let video = document.getElementById('result-video');
            if (!video) {
                video = document.createElement('video');
                video.id = 'result-video';
                video.controls = true;
                video.autoplay = true;
                video.loop = true;
                video.className = resultImage ? resultImage.className : 'w-full h-auto rounded-lg shadow-2xl';
                resultContainer.appendChild(video);
            }
            video.src = url;
            video.classList.remove('hidden');
            video.style.display = 'block';
        } else {
            // Hide video
            const video = document.getElementById('result-video');
            if (video) {
                video.classList.add('hidden');
                video.style.display = 'none';
            }
            
            // Show image
            if (resultImage) {
                resultImage.classList.remove('hidden');
                resultImage.style.display = 'block';
                resultImage.src = url + '?t=' + new Date().getTime();
            }
        }
    }

    function showDownloadButton(url) {
        if (downloadBtn) {
            downloadBtn.dataset.url = url;
            downloadBtn.disabled = false;
        }
    }

    // --- Main Logic Handlers ---

    // Handler when file is selected - uploads immediately
    async function handleFileSelect(file) {
        if (!file) return;
        
        try {
            showLoading();
            updateStatus('UPLOADING...');
            
            // Upload immediately when file is selected
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            // Show the uploaded image preview
            showPreview(uploadedUrl);
            
            updateStatus('READY');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
            // Reset UI on error
            if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
            if (previewImage) previewImage.classList.add('hidden');
            if (dropZone) dropZone.classList.remove('has-file');
        }
    }

    // Handler when Generate button is clicked
    async function handleGenerate() {
        if (!currentUploadedUrl) {
            alert('Please select an image first.');
            return;
        }
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            
            // Step 1: Submit job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            console.log('Job ID:', jobData.jobId);
            
            updateStatus('PROCESSING... (0)');
            
            // Step 2: Poll for completion
            const result = await pollJobStatus(jobData.jobId);
            
            // Step 3: Extract result URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.video || resultItem?.image;
            
            if (!resultUrl) {
                console.error('Response:', result);
                throw new Error('No image URL in response');
            }
            
            console.log('Result URL:', resultUrl);
            
            // Step 4: Display result
            showResultMedia(resultUrl);
            showDownloadButton(resultUrl);
            
            updateStatus('COMPLETE');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // --- Event Wiring ---

    // File Input Change
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFileSelect(e.target.files[0]);
        });
    }

    // Drop Zone Events
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
            dropZone.style.borderColor = 'var(--primary)';
            dropZone.style.background = 'rgba(255, 184, 0, 0.1)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });
        
        // Click to upload
        dropZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Generate Button
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentUploadedUrl = null;
            if (fileInput) fileInput.value = '';
            
            // Reset Preview
            if (previewImage) {
                previewImage.src = '';
                previewImage.classList.add('hidden');
            }
            if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
            if (dropZone) dropZone.classList.remove('has-file');
            
            // Reset Results
            if (resultImage) resultImage.classList.add('hidden');
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            const video = document.getElementById('result-video');
            if (video) video.classList.add('hidden');
            
            // Reset Buttons
            if (downloadBtn) {
                downloadBtn.disabled = true;
                downloadBtn.dataset.url = '';
            }
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'GENERATE MUGSHOT';
            }
            
            updateStatus('');
        });
    }

    // DOWNLOAD BUTTON - Robust Logic
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;
            
            // Helper to trigger download from blob
            function downloadBlob(blob, filename) {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }
            
            // Helper to get extension
            function getExtension(url, contentType) {
                if (contentType) {
                    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
                    if (contentType.includes('png')) return 'png';
                    if (contentType.includes('webp')) return 'webp';
                    if (contentType.includes('mp4')) return 'mp4';
                    if (contentType.includes('webm')) return 'webm';
                }
                const match = url.match(/\.(jpe?g|png|webp|mp4|webm)/i);
                return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
            }
            
            try {
                // STRATEGY 1: Proxy Download
                const proxyUrl = 'https://api.chromastudio.ai/download-proxy?url=' + encodeURIComponent(url);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Proxy failed: ' + response.status);
                
                const blob = await response.blob();
                const ext = getExtension(url, response.headers.get('content-type'));
                downloadBlob(blob, 'mugshot_result_' + generateNanoId(6) + '.' + ext);
                
            } catch (proxyErr) {
                console.warn('Proxy download failed, trying direct fetch:', proxyErr.message);
                
                // STRATEGY 2: Direct Fetch
                try {
                    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
                    const response = await fetch(fetchUrl, { mode: 'cors' });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const ext = getExtension(url, response.headers.get('content-type'));
                        downloadBlob(blob, 'mugshot_result_' + generateNanoId(6) + '.' + ext);
                        return;
                    }
                    throw new Error('Direct fetch failed: ' + response.status);
                } catch (fetchErr) {
                    console.warn('Direct fetch failed:', fetchErr.message);
                    alert('Download failed due to browser security restrictions. Please right-click the result image and select "Save Image As".');
                }
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }

    // --- Modals Logic (Kept from original) ---
    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; 
        }
    };

    const closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if(modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    };

    document.querySelectorAll('[data-modal-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-modal-target');
            openModal(targetId);
        });
    });

    document.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-modal-close');
            closeModal(targetId);
        });
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if(e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

});