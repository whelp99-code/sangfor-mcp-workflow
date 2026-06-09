/**
 * MCP Stdio Client — sangfor-engineer-mcp의 MCP tools를 stdio로 호출
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createLogger, nowId } from '@sangfor/workflow-shared';

const log = createLogger('mcp-client');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: { code: number; message: string };
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, any>;
}

// ─── MCP Stdio 클라이언트 ───────────────────────────────────────────────────

export class McpStdioClient {
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private buffer: string = '';
  private serverPath: string;
  private initialized: boolean = false;

  constructor(serverPath: string) {
    this.serverPath = serverPath;
  }

  // 서버 시작
  async start(): Promise<void> {
    if (this.process) {
      log.warn('Server already running');
      return;
    }

    log.info(`Starting MCP server: ${this.serverPath}`);

    this.process = spawn('npx', ['tsx', this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleData(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      log.debug(`stderr: ${data.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      log.info(`MCP server exited with code ${code}`);
      this.process = null;
      this.initialized = false;
    });

    // 초기화
    await this.initialize();
  }

  // 서버 중지
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }

  // 초기화
  private async initialize(): Promise<void> {
    const result = await this.sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'sangfor-mcp-workflow', version: '0.1.0' },
      },
    });

    if (result.error) {
      throw new Error(`Failed to initialize MCP server: ${result.error.message}`);
    }

    this.initialized = true;
    log.info('MCP server initialized');
  }

  // tool 목록 조회
  async listTools(): Promise<any[]> {
    const result = await this.sendRequest({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
    });

    return result.result?.tools || [];
  }

  // tool 호출
  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('MCP server not initialized');
    }

    log.info(`Calling tool: ${name}`);

    const result = await this.sendRequest({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    });

    if (result.error) {
      throw new Error(`Tool call failed: ${result.error.message}`);
    }

    // 결과 파싱
    const content = result.result?.content?.[0]?.text;
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }

    return result.result;
  }

  // 요청 전송
  private sendRequest(request: McpRequest): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP server not running'));
        return;
      }

      this.pendingRequests.set(request.id, { resolve, reject });

      const data = JSON.stringify(request) + '\n';
      this.process.stdin.write(data);

      // 타임아웃 (60초)
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error(`Request timeout: ${request.method}`));
        }
      }, 60000);
    });
  }

  // 데이터 수신 처리
  private handleData(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: McpResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch {
        log.debug(`Failed to parse: ${line}`);
      }
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.process !== null && this.initialized;
  }
}

// ─── 싱글톤 인스턴스 ────────────────────────────────────────────────────────

let defaultClient: McpStdioClient | null = null;

export function getMcpClient(serverPath?: string): McpStdioClient {
  if (!defaultClient && serverPath) {
    defaultClient = new McpStdioClient(serverPath);
  }
  if (!defaultClient) {
    throw new Error('MCP client not initialized. Provide serverPath.');
  }
  return defaultClient;
}
