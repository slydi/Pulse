async function fetchAllReleases(username, repo) {
    let releases = [];
    let page = 1;
    
    try {
        while (true) {
            const res = await fetch(`https://api.github.com/repos/${username}/${repo}/releases?page=${page}&per_page=30`);
            
            if (res.status === 403) {
                const resetTime = res.headers.get('X-RateLimit-Reset');
                if (resetTime) {
                    const waitTime = Math.ceil((resetTime * 1000 - Date.now()) / 1000 / 60);
                    throw new Error(`GitHub API rate limit exceeded. Try again in ${waitTime} minutes.`);
                } else {
                    throw new Error('GitHub API rate limit exceeded. Please try again later.');
                }
            }
            
            if (res.status === 404) {
                throw new Error('Repository not found');
            }
            
            if (!res.ok) {
                throw new Error(`API error: ${res.status} ${res.statusText}`);
            }
            
            const data = await res.json();
            
            if (data.length === 0) break;
            
            releases = releases.concat(data);
            page++;
        }
        
        return releases;
        
    } catch (error) {
        if (error.message.includes('rate limit')) {
            throw error;
        }
        throw new Error(error.message);
    }
}

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        username: params.get('username'),
        repo: params.get('repo'),
        tag: params.get('tag')
    };
}

function autoFillFromUrl() {
    const { username, repo, tag } = getUrlParams();
    
    if (username) {
        document.querySelector('input[name="username"]').value = username;
    }
    if (repo) {
        document.querySelector('input[name="repository"]').value = repo;
    }
    if (tag) {
        document.querySelector('input[name="releaseTag"]').value = tag;
    }
    
    if (username && repo) {
        setTimeout(() => {
            document.querySelector('form').dispatchEvent(new Event('submit'));
        }, 500);
    }
}

function updateUrlParams(username, repo, tag = '') {
    const params = new URLSearchParams();
    if (username) params.set('username', username);
    if (repo) params.set('repo', repo);
    if (tag) params.set('tag', tag);
    
    const newUrl = window.location.origin + window.location.pathname + '?' + params.toString();
    window.history.pushState({}, '', newUrl);
}

document.addEventListener('DOMContentLoaded', function() {
    autoFillFromUrl();
    
    document.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = e.target.username.value.trim();
        const repo = e.target.repository.value.trim();
        const tag = e.target.releaseTag.value.trim();

        updateUrlParams(username, repo, tag);

        const container = document.querySelector(".content");
        container.innerHTML = `<div class="loader"><div class="loader-spinner"></div></div>`;

        try {
            let releases = await fetchAllReleases(username, repo);

            if (releases.length === 0) {
                container.innerHTML = `<div class="no-releases">No releases found for this repository</div>`;
                return;
            }

            if (tag) {
                releases = releases.filter(r => r.tag_name === tag);
                if (releases.length === 0) {
                    container.innerHTML = `<div class="no-releases">Release with tag "${tag}" not found</div>`;
                    return;
                }
            }

            container.innerHTML = "";

            const totalDownloads = releases.reduce((sum, r) => sum + r.assets.reduce((aSum, asset) => aSum + asset.download_count, 0), 0);

            const totalDiv = document.createElement("div");
            totalDiv.className = "total-downloads";
            totalDiv.innerHTML = `<i class="fas fa-download"></i> Total Downloads: <span class="downloads-count">${totalDownloads}</span>`;
            container.appendChild(totalDiv);

            releases.forEach((r, i) => {
                const card = document.createElement("div");
                card.className = "release-card";

                const header = document.createElement("div");
                header.className = "release-header";
                header.innerHTML = `
                    <span class="version">
                        ${r.tag_name}
                        ${i === 0 && !tag ? '<span class="latest-label"><i class="fas fa-star"></i> Latest</span>' : ''}
                    </span>
                    <span class="download-count">
                        <i class="fas fa-download"></i>
                        ${r.assets.reduce((acc, a) => acc + a.download_count, 0)} 
                    </span>
                `;
                card.appendChild(header);

                const meta = document.createElement("div");
                meta.className = "release-meta";
                meta.innerHTML = `
                    <span class="release-author">
                        <i class="fas fa-user"></i> Author: <span class="author-name">${r.author.login}</span>
                    </span>
                    <span class="release-date">
                        <i class="fas fa-calendar-alt"></i> Date: ${new Date(r.published_at).toLocaleDateString()}
                    </span>
                `;
                card.appendChild(meta);

                const filesDiv = document.createElement("div");
                filesDiv.className = "file-list";

                // Add file list header
                const fileHeader = document.createElement("div");
                fileHeader.className = "file-list-header";
                fileHeader.innerHTML = `
                    <span class="files-title">
                        <i class="fas fa-file"></i> Files Name
                    </span>
                    <span class="downloads-title">
                        <i class="fas fa-download"></i> Downloads
                    </span>
                `;
                filesDiv.appendChild(fileHeader);

                // Add files
                if (r.assets.length > 0) {
                    r.assets.forEach(f => {
                        const item = document.createElement("div");
                        item.className = "file-item";
                        item.innerHTML = `
                            <a href="${f.browser_download_url}" target="_blank">
                                ${f.name}
                            </a>
                            <span>${f.download_count}</span>
                        `;
                        filesDiv.appendChild(item);
                    });
                } else {
                    const noFilesItem = document.createElement("div");
                    noFilesItem.className = "file-item";
                    noFilesItem.innerHTML = `
                        <span style="color: #ccc; font-style: italic;">No files available</span>
                        <span>0</span>
                    `;
                    filesDiv.appendChild(noFilesItem);
                }

                card.appendChild(filesDiv);
                container.appendChild(card);
            });

        } catch (err) {
            container.innerHTML = `<p style="text-align: center;">${err.message}</p>`;
        }
    });
});