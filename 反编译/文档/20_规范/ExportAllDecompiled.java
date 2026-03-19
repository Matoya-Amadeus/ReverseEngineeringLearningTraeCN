//Export ALL decompiled functions to a C file
//@category Export

import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.*;
import java.io.*;

public class ExportAllDecompiled extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);
        
        String outputPath = getScriptArgs()[0];
        PrintWriter writer = new PrintWriter(new FileWriter(outputPath));
        
        FunctionManager funcMgr = currentProgram.getFunctionManager();
        FunctionIterator funcs = funcMgr.getFunctions(true);
        int totalFuncs = funcMgr.getFunctionCount();
        
        writer.println("// Decompiled by Ghidra");
        writer.println("// File: " + currentProgram.getName());
        writer.println("// Total Functions: " + totalFuncs);
        writer.println();
        
        int count = 0;
        int successCount = 0;
        
        while (funcs.hasNext() && !monitor.isCancelled()) {
            Function func = funcs.next();
            String name = func.getName();
            count++;
            
            DecompileResults results = decomp.decompileFunction(func, 120, monitor);
            if (results.decompileCompleted()) {
                writer.println("// ========================================");
                writer.println("// Function " + count + "/" + totalFuncs + ": " + name);
                writer.println("// Address: " + func.getEntryPoint());
                writer.println("// Size: " + func.getBody().getNumAddresses() + " bytes");
                writer.println();
                if (results.getDecompiledFunction() != null) {
                    writer.println(results.getDecompiledFunction().getC());
                }
                writer.println();
                successCount++;
            }
            
            if (count % 500 == 0) {
                println("Progress: " + count + "/" + totalFuncs + " functions processed, " + successCount + " decompiled successfully");
            }
        }
        
        writer.println();
        writer.println("// ========================================");
        writer.println("// END OF DECOMPILATION");
        writer.println("// Total processed: " + count);
        writer.println("// Successfully decompiled: " + successCount);
        writer.close();
        decomp.dispose();
        println("Exported " + successCount + "/" + totalFuncs + " functions to " + outputPath);
    }
}
