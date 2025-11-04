// UHP Bridge Server for HYVEMYND
// Connects browser game to UHP engines like nokamute.exe

const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments for port
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const cmdLinePort = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : null;

const PORT = cmdLinePort || process.env.UHP_PORT || 8080;

// Engine discovery - looks in common locations
const ENGINE_PATHS = {
    nokamute: [
        './tools/nokamute.exe',
        './engines/nokamute.exe',
        './nokamute.exe',
        '../engines/nokamute.exe',
        '../reference-ai-5/target/release/nokamute.exe',
        'C:/Program Files/Nokamute/nokamute.exe',
        process.argv[2] // Command line override
    ].filter(Boolean),
    
    mzinga: [
        './engines/MzingaEngine.exe',
        './MzingaEngine.exe',
        '../engines/MzingaEngine.exe',
        '../reference-ai-4/MzingaEngine.exe',
        'C:/Program Files/Mzinga/MzingaEngine.exe'
    ]
};

function findEngine(engineType = 'nokamute') {
    const paths = ENGINE_PATHS[engineType] || ENGINE_PATHS.nokamute;
    
    for (const enginePath of paths) {
        if (fs.existsSync(enginePath)) {
            // Resolve to absolute path to fix spawn issues
            const absolutePath = path.resolve(enginePath);
            console.log(`✅ Found ${engineType} engine at: ${absolutePath}`);
            return absolutePath;
        }
    }
    
    console.warn(`⚠️  Could not find ${engineType} engine. Searched: ${paths.join(', ')}`);
    return null;
}

class UHPBridge {
    constructor() {
        this.wss = new WebSocket.Server({ port: PORT });
        this.currentEngine = null;
        this.currentEngineType = 'nokamute';
        this.clients = new Set();
        
        console.log('🚀 HYVEMYND UHP Bridge starting on port', PORT);
        this.setupWebSocketServer();
    }

    setupWebSocketServer() {
        this.wss.on('connection', (ws) => {
            console.log('🔗 HYVEMYND client connected');
            this.clients.add(ws);
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'bridge-ready',
                message: 'HYVEMYND UHP Bridge connected',
                timestamp: new Date().toISOString()
            }));
            
            ws.on('message', (message) => {
                try {
                    const msg = JSON.parse(message);
                    this.handleMessage(ws, msg);
                } catch (error) {
                    console.error('Invalid message:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
                }
            });
            
            ws.on('close', () => {
                console.log('🔌 HYVEMYND client disconnected');
                this.clients.delete(ws);
                if (this.clients.size === 0) {
                    this.killCurrentEngine();
                }
            });
        });
    }

    handleMessage(ws, msg) {
        switch (msg.type) {
            case 'start-engine':
                this.startEngine(ws, msg.engine || 'nokamute');
                break;
                
            case 'stop-engine':
                this.killCurrentEngine();
                this.broadcast({ type: 'engine-stopped' });
                break;
                
            case 'command':
                this.sendCommand(ws, msg.data);
                break;
                
            case 'list-engines':
                this.listAvailableEngines(ws);
                break;
                
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
                
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
    }

    broadcast(message) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    startEngine(ws, engineType) {
        try {
            // Kill existing engine
            this.killCurrentEngine();
            
            const enginePath = findEngine(engineType);
            if (!enginePath) {
                throw new Error(`Engine '${engineType}' not found`);
            }
            
            this.currentEngineType = engineType;
            
            console.log(`🤖 Starting ${engineType} engine: ${enginePath}`);
            
            this.currentEngine = spawn(enginePath, [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.dirname(enginePath)
            });
            
            this.setupEngineHandlers();
            
            this.broadcast({
                type: 'engine-started',
                engine: engineType,
                path: enginePath,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Failed to start engine:', error.message);
            ws.send(JSON.stringify({
                type: 'error',
                message: `Failed to start ${engineType}: ${error.message}`
            }));
        }
    }

    setupEngineHandlers() {
        if (!this.currentEngine) return;
        
        let responseBuffer = '';
        
        // Forward engine output to all clients
        this.currentEngine.stdout.on('data', (data) => {
            responseBuffer += data.toString();
            
            let lineEnd;
            while ((lineEnd = responseBuffer.indexOf('\n')) !== -1) {
                const line = responseBuffer.substring(0, lineEnd).trim();
                responseBuffer = responseBuffer.substring(lineEnd + 1);
                
                if (line) {
                    console.log(`${this.currentEngineType} →`, line);
                    this.broadcast({ 
                        type: 'engine-line', 
                        line: line,
                        engine: this.currentEngineType,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
        
        this.currentEngine.stderr.on('data', (data) => {
            const errorMsg = data.toString().trim();
            console.error(`${this.currentEngineType} error:`, errorMsg);
            this.broadcast({ 
                type: 'engine-error', 
                message: errorMsg,
                engine: this.currentEngineType
            });
        });
        
        this.currentEngine.on('exit', (code) => {
            console.log(`🤖 ${this.currentEngineType} exited with code`, code);
            this.broadcast({ 
                type: 'engine-exit', 
                code: code,
                engine: this.currentEngineType 
            });
            this.currentEngine = null;
        });

        this.currentEngine.on('error', (error) => {
            console.error(`${this.currentEngineType} spawn error:`, error);
            this.broadcast({
                type: 'engine-error',
                message: `Engine spawn error: ${error.message}`,
                engine: this.currentEngineType
            });
        });
    }

    sendCommand(ws, command) {
        if (!this.currentEngine) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'No engine running'
            }));
            return;
        }
        
        console.log(`HYVEMYND → ${this.currentEngineType}:`, command);
        this.currentEngine.stdin.write(command + '\n');
    }

    listAvailableEngines(ws) {
        const available = {};
        
        for (const [engineType, paths] of Object.entries(ENGINE_PATHS)) {
            for (const enginePath of paths) {
                if (fs.existsSync(enginePath)) {
                    available[engineType] = {
                        path: enginePath,
                        found: true,
                        name: engineType.charAt(0).toUpperCase() + engineType.slice(1)
                    };
                    break;
                }
            }
            
            if (!available[engineType]) {
                available[engineType] = {
                    path: null,
                    found: false,
                    name: engineType.charAt(0).toUpperCase() + engineType.slice(1)
                };
            }
        }
        
        ws.send(JSON.stringify({
            type: 'engines-list',
            engines: available,
            timestamp: new Date().toISOString()
        }));
    }

    killCurrentEngine() {
        if (this.currentEngine) {
            console.log(`🛑 Stopping ${this.currentEngineType} engine`);
            this.currentEngine.kill();
            this.currentEngine = null;
        }
    }
}

// Start the bridge
const bridge = new UHPBridge();

console.log('✅ HYVEMYND UHP Bridge ready!');
console.log(`   Connect your game to ws://localhost:${PORT}`);
console.log('   Available engines:', Object.keys(ENGINE_PATHS).join(', '));
console.log('   Press Ctrl+C to stop');

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down HYVEMYND UHP Bridge');
    bridge.killCurrentEngine();
    process.exit();
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    bridge.killCurrentEngine();
    process.exit(1);
});