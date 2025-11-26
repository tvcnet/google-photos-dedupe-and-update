import { GoogleGenAI, Type, Schema } from "@google/genai";
import { WPPluginRawData, AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * PASS 1: Web Research
 * Uses Gemini Pro with Google Search to find known CVEs and reputation issues.
 * This function returns unstructured text which is then fed into the second pass.
 */
const performWebResearch = async (pluginName: string, slug: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Latest preview model
      contents: `Research the WordPress plugin "${pluginName}" (slug: ${slug}). 
            Find any known security vulnerabilities (CVEs), recent security advisories, hack reports, or reputation issues from the last 3 years.
            Also check if the plugin has been closed or removed from the repository recently.
            Summarize the findings and list the URLs of the sources.`,
      config: {
        tools: [{ googleSearch: {} }],
        // Note: responseSchema/MimeType is NOT allowed with googleSearch
      }
    });

    // Extract text and grounding metadata (URLs)
    const text = response.text || "No specific web results found.";

    let sources = "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      sources = "\n\nSources Found:\n" + chunks
        .map(c => c.web?.uri ? `- ${c.web.title}: ${c.web.uri}` : "")
        .filter(s => s)
        .join("\n");
    }

    return `=== WEB SEARCH FINDINGS ===\n${text}\n${sources}`;
  } catch (e) {
    console.warn("Web research failed:", e);
    return "=== WEB SEARCH FINDINGS ===\nWeb search unavailable.";
  }
};

/**
 * PASS 2: Synthesis & Static Analysis
 * Combines Metadata + Source Code + Web Research to generate the final JSON report.
 */
export const analyzePluginWithGemini = async (plugin: WPPluginRawData, webResearchContext: string): Promise<AIAnalysisResult> => {

  // Construct a context that includes metadata AND source code
  const cleanDescription = plugin.sections.description.replace(/<[^>]*>?/gm, '').substring(0, 1000);

  let codeContext = "No source code available (Analysis based on metadata only).";
  let fileList = "";

  if (plugin.sourceCodeFiles && plugin.sourceCodeFiles.length > 0) {
    fileList = plugin.sourceCodeFiles.map(f => f.name).join(", ");
    codeContext = plugin.sourceCodeFiles.map(f =>
      `--- FILE: ${f.name} ---\n${f.content}\n--- END FILE ---`
    ).join("\n\n");
  }

  const promptContext = `
    You are a Senior WordPress Security Researcher and Code Auditor. 
    Your job is to perform a deep security audit (SAST) on the following WordPress Plugin.
    You have access to the Plugin Metadata, Source Code snippets, and a Web Search Summary of known issues.

    === METADATA ===
    Name: ${plugin.name}
    Slug: ${plugin.slug}
    Author: ${plugin.author}
    Installs: ${plugin.active_installs}
    Last Updated: ${plugin.last_updated}
    Rating: ${plugin.rating}%
    Description: ${cleanDescription}

    ${webResearchContext}

    === FILES ANALYZED ===
    ${fileList}

    === SOURCE CODE (Truncated for analysis) ===
    ${codeContext}
    
    === INSTRUCTIONS ===
    1. **Deep Code Analysis (SAST)**: Analyze the provided PHP/JS code for security vulnerabilities.
       - Look for **SQL Injection**: Use of '$wpdb->query' or '$wpdb->get_results' without 'prepare()'.
       - Look for **XSS**: Echoing variables without escaping functions (e.g., 'echo $var' instead of 'echo esc_html($var)').
       - Look for **CSRF**: Processing form data ($_POST) without 'wp_verify_nonce'.
       - Look for **Authorization**: Performing actions without 'current_user_can' checks.
    
    2. **WordPress Coding Standards (WPCS) Compliance**:
       - **Prefixing**: Do functions, classes, and global variables start with a unique prefix (e.g., 'wc_', 'myplugin_')? Mark as error if generic names are used.
       - **Direct DB Calls**: Check for 'WordPress.DB.DirectDatabaseQuery'. Direct DB calls should be cached or avoided if an API exists.
       - **Sanitization**: Check for 'WordPress.Security.ValidatedSanitizedInput'. Are $_GET/$_POST variables sanitized (e.g. 'sanitize_text_field') before use?
       - **Escaping**: Check for 'WordPress.Security.EscapeOutput'. Is output escaped late?
       - **Semantics**: Report deprecated functions or incorrect parameter usage.

    3. **Web Intelligence Integration**:
       - Incorporate the "WEB SEARCH FINDINGS" into your risk assessment. 
       - If the web search found CVEs, include them in the 'externalRisks' array.
       - If the code analysis finds the *same* issues, mark them as 'Critical'.

    4. **Scoring & Verdict**:
       - Generate a strict Trust Score (0-100).
       - < 50: Critical issues found, abandoned, or known unpatched CVEs.
       - 50-75: Minor issues, poor code quality, lack of escaping/sanitization, or WPCS violations.
       - > 75: Follows best practices, secure code, good reputation.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER, description: "A score from 0 to 100 representing plugin health and security." },
      verdict: { type: Type.STRING, enum: ["Excellent", "Good", "Caution", "Avoid"] },
      summary: { type: Type.STRING, description: "Executive summary of the audit combining code quality, WP standard adherence, and external intel." },
      codeQualityRating: { type: Type.STRING, enum: ["A", "B", "C", "D", "F"], description: "Grade for code cleanliness, standard adherence, and security." },
      pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 key positive aspects." },
      cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 key negative aspects." },
      securityRiskAssessment: { type: Type.STRING, description: "Detailed assessment of security posture." },
      maintenanceHealth: { type: Type.STRING, description: "Assessment of updates and compatibility." },
      externalRisks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            url: { type: Type.STRING },
            source: { type: Type.STRING, description: "Source name (e.g. Patchstack, WPScan, or 'Web Search')" }
          }
        },
        description: "List of known vulnerabilities found via web search or external databases."
      },
      vulnerabilities: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            file: { type: Type.STRING, description: "Filename where issue was found." },
            lineNumber: { type: Type.STRING, description: "Line number or 'General'." },
            severity: { type: Type.STRING, enum: ["Critical", "High", "Medium", "Low"] },
            issueType: { type: Type.STRING, description: "Short name of vulnerability (e.g. SQL Injection, WPCS Violation)." },
            description: { type: Type.STRING, description: "Explanation of the vulnerability." },
            snippet: { type: Type.STRING, description: "The vulnerable code snippet (if applicable)." }
          },
          required: ["file", "lineNumber", "severity", "issueType", "description"]
        }
      }
    },
    required: ["score", "verdict", "summary", "pros", "cons", "securityRiskAssessment", "maintenanceHealth", "vulnerabilities", "codeQualityRating", "externalRisks"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: promptContext,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as AIAnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error(`Failed to generate AI analysis: ${(error as Error).message}`);
  }
};

export { performWebResearch };