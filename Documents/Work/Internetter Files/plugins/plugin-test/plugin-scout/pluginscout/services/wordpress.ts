import JSZip from 'jszip';
import { WPPluginRawData } from '../types';

/**
 * Fetches plugin metadata from the WordPress.org API.
 * Includes fallback to search if direct slug lookup fails.
 */
export const fetchPluginInfo = async (slugOrUrl: string): Promise<WPPluginRawData> => {
  // 1. Sanitize input
  let term = slugOrUrl.trim();
  let slug = term.toLowerCase();
  
  // Extract slug if it looks like a URL
  if (slug.includes('wordpress.org/plugins/')) {
    const match = slug.match(/plugins\/([^\/]+)\/?/);
    if (match && match[1]) {
      slug = match[1];
    }
  }
  slug = slug.replace(/\/$/, '');

  // Helper to fetch details by slug
  const getDetails = async (s: string) => {
      const apiUrl = `https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${encodeURIComponent(s)}&request[fields][sections]=1&request[fields][ratings]=1&request[fields][active_installs]=1&request[fields][last_updated]=1&request[fields][versions]=1&request[fields][download_link]=1`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`WordPress API Error: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data || data.error) return null;
      return data as WPPluginRawData;
  };

  // 2. Try direct slug fetch first (unless it obviously looks like a search query with spaces)
  if (!slug.includes(' ')) {
      const data = await getDetails(slug);
      if (data) return data;
  }

  // 3. Fallback: Search for the term
  console.log(`Direct lookup for '${slug}' failed or skipped. Searching...`);
  const searchUrl = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request[search]=${encodeURIComponent(term)}&request[per_page]=1`;
  const searchRes = await fetch(searchUrl);
  
  if (!searchRes.ok) {
      throw new Error("Failed to search for plugin.");
  }

  const searchData = await searchRes.json();
  if (searchData && searchData.plugins && searchData.plugins.length > 0) {
      const bestMatchSlug = searchData.plugins[0].slug;
      console.log(`Found search match: ${bestMatchSlug}`);
      const matchData = await getDetails(bestMatchSlug);
      if (matchData) return matchData;
  }

  throw new Error('Plugin not found. Please check the name or slug.');
};

/**
 * Shared logic to extract relevant source code files from a loaded JSZip object.
 */
const extractSourceFiles = async (zip: JSZip): Promise<Array<{ name: string; content: string }>> => {
    const files: Array<{ name: string; content: string }> = [];
    
    // INCREASED LIMITS for better analysis coverage
    const maxFiles = 50; 
    const maxFileSize = 100000; // ~100KB

    // Prioritize file types
    const importantExtensions = ['.php', '.js'];
    const ignoredDirs = ['node_modules', 'vendor', 'assets', 'images', 'dist', 'test', 'tests', 'lang', 'languages', 'fonts', 'lib', 'libs', 'css', 'scss'];

    // Iterate through files
    const entries = Object.keys(zip.files).filter(filename => {
       const isDir = zip.files[filename].dir;
       if (isDir) return false;
       
       const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
       if (!importantExtensions.includes(ext)) return false;

       // Check ignored directories
       if (ignoredDirs.some(dir => filename.includes(`/${dir}/`))) return false;
       
       // Ignore minified files
       if (filename.endsWith('.min.js')) return false;

       return true;
    });

    // Sort to prioritize logic-heavy files
    entries.sort((a, b) => {
        const score = (name: string) => {
            let s = 0;
            // High priority for main plugin file and includes
            if (!name.includes('/')) s += 10; 
            if (name.endsWith('.php')) s += 5;
            
            // Security critical areas
            if (name.includes('class-')) s += 3;
            if (name.includes('admin')) s += 4;
            if (name.includes('ajax')) s += 4;
            if (name.includes('api')) s += 4;
            if (name.includes('functions')) s += 2;
            if (name.includes('security')) s += 5; 
            
            // Lower priority
            if (name.includes('template')) s -= 1;
            if (name.includes('view')) s -= 1;
            if (name.includes('index.php')) s -= 10; // Usually empty
            return s;
        };
        return score(b) - score(a);
    });

    let processedCount = 0;

    for (const filename of entries) {
        if (processedCount >= maxFiles) break;

        try {
            const fileData = await zip.files[filename].async('string');
            
            // Skip empty or tiny files
            if (!fileData || fileData.trim().length < 50) continue;

            // Simple truncation to save tokens
            const content = fileData.length > maxFileSize 
                ? fileData.substring(0, maxFileSize) + "\n...[truncated]..." 
                : fileData;

            files.push({
                name: filename,
                content: content
            });
            processedCount++;
        } catch (e) {
            console.warn(`Could not read file ${filename}`, e);
        }
    }

    return files;
};

/**
 * Downloads the plugin ZIP from WP Repo, unzips it, and reads relevant code files.
 */
export const fetchPluginSourceCode = async (downloadLink: string): Promise<Array<{ name: string; content: string }>> => {
  try {
    // Use a CORS proxy to fetch the ZIP file
    const corsProxy = 'https://corsproxy.io/?'; 
    const url = `${corsProxy}${encodeURIComponent(downloadLink)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to download plugin zip file");

    const blob = await response.blob();
    const zip = await JSZip.loadAsync(blob);

    return await extractSourceFiles(zip);

  } catch (error) {
    console.error("Source code fetch failed:", error);
    return [];
  }
};

/**
 * Processes a locally uploaded ZIP file to extract metadata and source code.
 */
export const processUploadedZip = async (file: File): Promise<WPPluginRawData> => {
    try {
        const zip = await JSZip.loadAsync(file);
        const sourceCodeFiles = await extractSourceFiles(zip);
        
        // Attempt to extract metadata from the main plugin file
        let name = file.name.replace(/\.zip$/i, '');
        let description = "No description found in plugin headers.";
        let version = "Unknown";
        let author = "Unknown";
        
        // Find the main PHP file by looking for "Plugin Name:" header
        for (const f of sourceCodeFiles) {
            if (f.name.endsWith('.php')) {
                // Check first 4KB for headers
                const head = f.content.substring(0, 4096);
                const nameMatch = head.match(/Plugin Name:\s*(.*)/i);
                
                if (nameMatch) {
                    name = nameMatch[1].trim();
                    const descMatch = head.match(/Description:\s*(.*)/i);
                    if (descMatch) description = descMatch[1].trim();
                    const verMatch = head.match(/Version:\s*(.*)/i);
                    if (verMatch) version = verMatch[1].trim();
                    const authMatch = head.match(/Author:\s*(.*)/i);
                    if (authMatch) author = authMatch[1].trim();
                    break; 
                }
            }
        }
    
        // Construct a partial WPPluginRawData object
        return {
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            version,
            author,
            author_profile: '',
            requires: 'Unknown',
            tested: 'Unknown',
            requires_php: 'Unknown',
            last_updated: new Date().toISOString(),
            added: new Date().toISOString(),
            homepage: '',
            sections: { description },
            download_link: '',
            tags: {},
            versions: {},
            num_ratings: 0,
            rating: 0,
            ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            active_installs: 0,
            downloaded: 0,
            sourceCodeFiles,
            isLocal: true
        };
    } catch (error) {
        throw new Error("Failed to process uploaded ZIP file: " + (error as Error).message);
    }
};