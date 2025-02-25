document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    // Check if we're on the index page or view page
    const isIndexPage = window.location.pathname === '/' || 
                       window.location.pathname.endsWith('index.php') || 
                       window.location.pathname === '/index.php';
    const isViewPage = window.location.pathname.includes('view.php') || 
                      /\/[a-zA-Z0-9]{8,}$/.test(window.location.pathname);
    
    console.log('Page type:', isIndexPage ? 'index' : (isViewPage ? 'view' : 'other'));
    
    // Elements
    const pasteContent = document.getElementById('pasteContent');
    const sendBtn = document.getElementById('sendBtn');
    const burnAfterReading = document.getElementById('burnAfterReading');
    const formatButtons = document.querySelectorAll('.format-selector .btn');
    const expirationDropdown = document.getElementById('expirationDropdown');
    const expirationOptions = document.querySelectorAll('.dropdown-menu .dropdown-item');
    
    console.log('Elements found:', {
        pasteContent: !!pasteContent,
        sendBtn: !!sendBtn,
        burnAfterReading: !!burnAfterReading,
        formatButtons: formatButtons.length,
        expirationDropdown: !!expirationDropdown,
        expirationOptions: expirationOptions.length
    });
    
    // Current state
    let currentFormat = 'plaintext';
    let currentExpiration = 604800; // 1 week in seconds
    
    // Format buttons click handler (create page)
    if (formatButtons) {
        formatButtons.forEach(button => {
            button.addEventListener('click', function() {
                formatButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentFormat = this.getAttribute('data-format');
                console.log('Format changed to:', currentFormat);
            });
        });
    }
    
    // Expiration options click handler (create page)
    if (expirationOptions) {
        expirationOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                expirationOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                currentExpiration = parseInt(this.getAttribute('data-value'));
                expirationDropdown.textContent = 'Expires: ' + this.textContent.trim();
                console.log('Expiration changed to:', currentExpiration);
            });
        });
    }
    
    // Send button click handler (create page)
    if (sendBtn) {
        console.log('Adding click event to send button');
        sendBtn.addEventListener('click', function(e) {
            console.log('Send button clicked');
            if (!pasteContent || !pasteContent.value.trim()) {
                alert('Please enter some content for your paste.');
                return;
            }
            
            createPaste();
        });
    } else {
        console.error('Send button not found!');
    }
    
    // Create and send paste (create page)
    function createPaste() {
        console.log('Creating paste...');
        
        // Prepare data for server
        const serverData = {
            data: pasteContent.value,
            expiration: currentExpiration,
            burnAfterReading: burnAfterReading && burnAfterReading.checked ? 1 : 0,
            format: currentFormat,
            encrypted: 0 // Always unencrypted
        };
        
        console.log('Sending data to server:', serverData);
        
        // Send to server
        fetch('create.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(serverData)
        })
        .then(response => {
            console.log('Server response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Server response data:', data);
            if (data.status === 'success') {
                // Redirect to the paste
                window.location.href = `view.php?id=${data.id}`;
            } else {
                alert('Error: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error creating paste:', error);
            alert('An error occurred while creating the paste: ' + error.message);
        });
    }
    
    // VIEW PAGE FUNCTIONALITY
    
    // Copy button functionality
    const copyDirectLink = document.getElementById('copyDirectLink');
    if (copyDirectLink) {
        copyDirectLink.addEventListener('click', function() {
            const directLink = document.getElementById('directLink');
            directLink.select();
            document.execCommand('copy');
            const originalText = copyDirectLink.innerHTML;
            copyDirectLink.innerHTML = '<i class="bi bi-check-circle me-1"></i>Copied!';
            setTimeout(() => {
                copyDirectLink.innerHTML = originalText;
            }, 2000);
        });
    }
}); 