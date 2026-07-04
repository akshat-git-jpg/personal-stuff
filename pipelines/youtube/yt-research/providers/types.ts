export interface AIProvider {
  complete(system: string, user: string): Promise<string>;
  vision(prompt: string, imagePaths: string[]): Promise<string>;
}
