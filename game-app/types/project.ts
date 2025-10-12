export interface ProjectMetadata {
  name: string
  description: string
  teamMembers?: string[]
  category?: string
  githubUrl?: string
  demoUrl?: string
}

export interface Project {
  id: bigint
  metadata: string
  votes: bigint
}

export interface ParsedProject extends Project {
  parsedMetadata: ProjectMetadata | null
}

export function parseProjectMetadata(metadataString: string): ProjectMetadata | null {
  try {
    return JSON.parse(metadataString) as ProjectMetadata
  } catch (e) {
    console.error('Failed to parse metadata:', metadataString, e)
    return null
  }
}
