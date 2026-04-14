use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct FlowGraph {
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
}

#[derive(Debug, Deserialize)]
pub struct FlowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct FlowEdge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Serialize)]
pub struct GeneratedCode {
    pub yaml: String,
    pub files: Vec<GeneratedFile>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn generate_code(graph: FlowGraph) -> Result<GeneratedCode, String> {
    let yaml = generate_nango_yaml(&graph)?;
    let files = generate_typescript_files(&graph)?;
    Ok(GeneratedCode { yaml, files })
}

fn generate_nango_yaml(graph: &FlowGraph) -> Result<String, String> {
    let mut yaml = String::from("integrations:\n");

    for node in &graph.nodes {
        match node.node_type.as_str() {
            "sync" => {
                let label = node.data["label"].as_str().unwrap_or("unnamed");
                yaml.push_str(&format!("  {}:\n", to_snake_case(label)));
                yaml.push_str("    type: sync\n");
                if let Some(freq) = node.data.get("frequency").and_then(|v| v.as_str()) {
                    yaml.push_str(&format!("    runs: {}\n", freq));
                }
                yaml.push('\n');
            }
            "action" => {
                let label = node.data["label"].as_str().unwrap_or("unnamed");
                yaml.push_str(&format!("  {}:\n", to_snake_case(label)));
                yaml.push_str("    type: action\n\n");
            }
            _ => {}
        }
    }

    Ok(yaml)
}

fn generate_typescript_files(graph: &FlowGraph) -> Result<Vec<GeneratedFile>, String> {
    let mut files = Vec::new();

    for node in &graph.nodes {
        match node.node_type.as_str() {
            "sync" => {
                let label = node.data["label"].as_str().unwrap_or("unnamed");
                let name = to_snake_case(label);
                let content = format!(
                    r#"import {{ createSync }} from '@nangohq/types';

export default createSync({{
  description: '{}',
  frequency: '{}',
  async exec(nango) {{
    // TODO: Implement sync logic
    const response = await nango.get({{
      endpoint: '{}',
    }});
    await nango.batchSave(response.data, '{}');
  }},
}});
"#,
                    label,
                    node.data.get("frequency").and_then(|v| v.as_str()).unwrap_or("every hour"),
                    node.data.get("endpoint").and_then(|v| v.as_str()).unwrap_or("/api/data"),
                    label,
                );
                files.push(GeneratedFile {
                    path: format!("{}.ts", name),
                    content,
                });
            }
            "action" => {
                let label = node.data["label"].as_str().unwrap_or("unnamed");
                let name = to_snake_case(label);
                let content = format!(
                    r#"import {{ createAction }} from '@nangohq/types';

export default createAction({{
  description: '{}',
  async exec(nango, input) {{
    // TODO: Implement action logic
    const response = await nango.post({{
      endpoint: '{}',
      data: input,
    }});
    return response.data;
  }},
}});
"#,
                    label,
                    node.data.get("endpoint").and_then(|v| v.as_str()).unwrap_or("/api/action"),
                );
                files.push(GeneratedFile {
                    path: format!("{}.ts", name),
                    content,
                });
            }
            _ => {}
        }
    }

    Ok(files)
}

fn to_snake_case(s: &str) -> String {
    s.chars()
        .enumerate()
        .fold(String::new(), |mut acc, (i, c)| {
            if c.is_uppercase() {
                if i > 0 {
                    acc.push('_');
                }
                acc.push(c.to_lowercase().next().unwrap_or(c));
            } else if c.is_whitespace() || c == '-' {
                acc.push('_');
            } else {
                acc.push(c);
            }
            acc
        })
}
