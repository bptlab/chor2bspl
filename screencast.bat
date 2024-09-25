@echo off
REM Welcome message
echo # Welcome to the screencast on translating object-aware BPMN choreography diagrams into BSPL information protocols.
echo # This prototype is developed in the context of a research paper titled "From Visual Choreographies to Flexible Information Protocols."
echo # In this screencast, we will apply the tool to the Order Management choreography located in the resources directory.
timeout /t 10 >nul

REM Step 1: Translate a Choreography to BSPL
echo.
echo # Step 1: Translate a Choreography to BSPL
echo # In the first step, we will translate a object-aware BPMN choreography diagram into a BSPL protocol. The tool takes as input the choreography, data model, and object lifecycles.
echo # Command to be executed:
echo # ctob translate -c ./resources/input/order_management/choreography.bpmn -d ./resources/input/order_management/data_model.json -l ./resources/input/order_management/object_lifecycles.json -op ./resources/output/order_management -on protocol
timeout /t 10 >nul
call ctob translate -c ./resources/input/order_management/choreography.bpmn -d ./resources/input/order_management/data_model.json -l ./resources/input/order_management/object_lifecycles.json -op ./resources/output/order_management -on protocol
echo.
timeout /t 1 >nul
echo # Translation complete. The output protocol is saved in the specified output directory.
timeout /t 3 >nul
echo # The resulting protocol looks as follows:
timeout /t 3 >nul
type .\resources\output\order_management\protocol.bspl
echo.
echo.
timeout /t 10 >nul

REM Step 2: Find Constraints
echo.
echo # Step 2: Find Constraints
echo # In the second step, we will identify control-flow constraints for the translated protocol given the choreography.
echo # Command to be executed:
echo # ctob find_constraints -c ./resources/input/order_management/choreography.bpmn -b ./resources/output/order_management/protocol.json -op ./resources/output/order_management
timeout /t 10 >nul
call ctob find_constraints -c ./resources/input/order_management/choreography.bpmn -b ./resources/output/order_management/protocol.json -op ./resources/output/order_management
echo.
timeout /t 1 >nul
echo # The constraints are saved in the specified output directory.
timeout /t 5 >nul

REM Step 3: Apply Constraints
echo.
echo # Step 3: Apply Constraints
echo # In this step, we will apply the identified constraints to the protocol to derive a refined protocol.
echo # Command to be executed:
echo # ctob constrain -b ./resources/output/order_management/protocol.json -c ./resources/output/order_management/constraints.json -op ./resources/output/order_management -on refined_protocol
timeout /t 10 >nul
call ctob constrain -b ./resources/output/order_management/protocol.json -c ./resources/output/order_management/constraints.json -op ./resources/output/order_management -on refined_protocol
echo.
echo # The constraints are applied. The refined protocol is saved in the specified output directory.
timeout /t 5 >nul
echo # The refined protocol looks as follows:
timeout /t 3 >nul
type .\resources\output\order_management\refined_protocol.bspl
echo.
echo.
timeout /t 10 >nul

REM Step 4: Compute Distinct Interaction Sequences
echo.
echo # Step 4: Compute Distinct Interaction Sequences
echo # Finally, we will compute distinct interaction sequences for both the original and refined protocols.
timeout /t 5 >nul
echo # First, we will compute distinct interaction sequences for the original protocol.
echo # Command to be executed:
echo # ctob sequences -b ./resources/output/order_management/protocol.json
timeout /t 5 >nul
call ctob sequences -b ./resources/output/order_management/protocol.json
echo.
timeout /t 1 >nul
echo # The tool found 143 distinct interaction sequences for the original protocol.
timeout /t 5 >nul

echo # Next, we will compute distinct interaction sequences for the refined protocol.
echo # Command to be executed:
echo # ctob sequences -b ./resources/output/order_management/refined_protocol.json
timeout /t 5 >nul
call ctob sequences -b ./resources/output/order_management/refined_protocol.json
echo.
timeout /t 1 >nul
echo # The tool found 2 distinct interaction sequences for the refined protocol that exactly match the choreography specification.
timeout /t 5 >nul

REM End of screencast
echo.
echo # The results show that the generated protocol allows for more distinct interaction sequences while the refined protocol exactly matches the choreography. 
echo # This concludes the screencast. Thank you for watching!
timeout /t 10 >nul
