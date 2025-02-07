// <reference types="Cypress" />
import * as user from "../../../fixtures/Users.json";
import * as workflows from "../../../fixtures/Workflows.json";

describe("Testing the workflow schedule on a recurring basis with a target application", () => {
	before("Loggin in and checking if agent exists", () => {
		cy.requestLogin(user.AdminName, user.AdminPassword);
		cy.waitForCluster("Self-Agent");
		cy.visit("/create-workflow");
	});

	let workflowName = '';
	let workflowNamespace = '';
	let workflowSubject = '';
	let scheduleDate = '';
	let scheduleTime = '';

	it("Creating a target application", () => {
		cy.createTargetApplication("default", "target-app-1", "nginx");
	});

	it("Scheduling a workflow with an existing target application", () => {
		cy.chooseAgent("Self-Agent");
    	cy.get("[data-cy=ControlButtons] Button").eq(0).click();
    	cy.chooseWorkflow(3, "");
    	cy.wait(500);
    	cy.get("[data-cy=ControlButtons] Button").eq(1).click();
    	cy.get("[data-cy=WorkflowNamespace] input").then(($namespace) => {
			workflowNamespace = $namespace.val();
			return;
		});
		cy.wait(1000);
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		scheduleDate = new Date();
		// Schedule 2 min later from current time
    	scheduleDate.setMinutes(scheduleDate.getMinutes()+2);
		cy.selectSchedule(1, 0, scheduleDate.getMinutes());
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.wait(1000);
		cy.get("[data-cy=schedule]").should("have.text", `At ${scheduleDate.getMinutes()} minutes past the hour, between 12:00 AM and 11:59 PM`);
		cy.get("[data-cy=ControlButtons] Button").eq(0).click(); // Clicking on finish Button
		cy.get("[data-cy=FinishModal]").should("be.visible");
		cy.get("[data-cy=WorkflowName]").then(($name) => {
			workflowName = $name.text();
			return;
		});
		cy.get("[data-cy=WorkflowSubject]").then(($subject) => {
			workflowSubject = $subject.text();
			return;
		});
		cy.get("[data-cy=GoToWorkflowButton]").click();
	});

    it("Checking Schedules Table for scheduled Workflow", () => {
		cy.GraphqlWait("workflowListDetails", "listSchedules");
		cy.visit("/workflows");
		cy.get("[data-cy=browseSchedule]").click();
		cy.wait("@listSchedules").its("response.statusCode").should("eq", 200);
		cy.wait(1000);
		cy.get("table")
			.find("tr")
			.eq(1)
			.then(($div) => {
				cy.wrap($div)
					.find("td")
					.eq(0)
					.should("have.text", workflowName); // Matching Workflow Name Regex
				cy.wrap($div).find("td").eq(1).should("have.text", "Self-Agent"); // Matching Target Agent
				scheduleTime = scheduleDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
				scheduleTime = scheduleTime.split(' ')[0];
				cy.wrap($div)
					.find("td")
					.eq(4)
					.should("include.text", scheduleTime);
                cy.waitUntil(() => 
                    cy.wrap($div)
					    .find("td")
					    .eq(4)
					    .then((nextRun) => {
                            const currDate = new Date();
                            const currTime = currDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).split(' ')[0];
                            return (nextRun.text().includes(currTime) ? true : false);
                        }),
                    {
                        verbose: true,
                        interval: 500,
                        timeout: 600000,
                    }
                );
            })
	});

	// it("Validating workflow existence and status on cluster", () => {
	// 	cy.validateWorkflowExistence(workflowName, workflowNamespace);
	// 	cy.validateWorkflowStatus(workflowName, workflowNamespace, ["Running"]);
	// });

	it("Checking Workflow Browsing Table for scheduled workflow", () => {
		cy.get("[data-cy=runs]").click();
		cy.wait(1000);
		cy.get("table")
			.find("tr")
			.eq(1)
			.then(($div) => {
				cy.wrap($div).find("td").eq(1).should("have.text", "Running"); // Matching Status
				cy.wrap($div)
					.find("td")
					.eq(2)
					.should("have.text", workflowName); // Matching Workflow Name Regex
				cy.wrap($div).find("td").eq(3).should("have.text", "Self-Agent"); // Matching Target Agent
				// Workflow Statistics (Graph View)
				cy.wrap($div).find("td").eq(2)
				cy.wrap($div).find("td").eq(2).click({ scrollBehavior: false });
			});
		cy.get("[data-cy=statsTabs]").find('button').eq(1).click();
		cy.get("[data-cy=workflowNamespace]").should("have.text", workflowNamespace);
		cy.waitUntil(() =>
			cy.get("[data-cy=workflowStatus]").then((status) => {
				return status.text() !== "Running" ? true : false;
			}),
			{
				verbose: true,
				interval: 500,
				timeout: 600000,
			}
		);
		// cy.validateWorkflowStatus(workflowName, workflowNamespace, ["Running", "Succeeded"]);
		cy.get("[data-cy=statsTabs]").find('button').eq(0).click();
		// Expected Nodes
		const graphNodesNameArray = ["install-chaos-experiments", "pod-delete", "revert-chaos"];
		// Verify nodes in dagre graph (TODO: Check status of nodes)
		cy.validateGraphNodes(graphNodesNameArray);
	});

	it("Validate Verdict, Resilience score and Experiments Passed", () => {
		cy.validateVerdict(workflowName, "Self-Agent", "Succeeded", 100, 1, 1);
	});

	it("Deleting the target application", () => {
		cy.deleteTargetApplication("default", "target-app-1");
	});

	it("Testing the workflow statistics", () => {
		cy.GraphqlWait("workflowListDetails", "recentRuns");
		cy.visit("/observability");
		cy.get("[data-cy=litmusDashboard]").click();
		cy.wait("@recentRuns").its("response.statusCode").should("eq", 200);
		cy.get(`[data-cy=${workflowName}]`)
			.find("[data-cy=statsButton]")
			.click();
		cy.validateWorkflowInfo(workflowName, workflowNamespace, workflowSubject, "Self-Agent", "Cron workflow", "Cron workflow");
		cy.validateStatsChart();
		cy.validateRecurringStats();
		const experimentArray = [
			{
				experimentName: "pod-delete",
				verdict: "Pass",
				weightOfTest: 10,
				resultingPoints: 10
			}
		];
		cy.validateExperimentsTable(experimentArray);
	});
});