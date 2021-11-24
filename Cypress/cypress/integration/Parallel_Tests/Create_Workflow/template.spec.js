/// <reference types="Cypress" />
import * as user from "../../../fixtures/Users.json";
import * as workflows from "../../../fixtures/Workflows.json";

export const workflowNamespace = Cypress.env("AGENT_NAMESPACE");
export const agent = Cypress.env("AGENT");
export const targetAppNamespace = Cypress.env("TARGET_APP_NS");

describe("Testing the workflow creation wizard using Templates", () => {
	before("Clearing the Cookies and deleting the Cookies", () => {
		cy.requestLogin(user.AdminName, user.AdminPassword);
		cy.waitForCluster(agent);
		cy.visit("/create-workflow");
	});

	let workflowName = '';
  	let workflowSubject = '';

	it("Running uploaded Workflow", () => {
		cy.chooseAgent(agent);
		cy.get("[data-cy=ControlButtons] Button").eq(0).click();
		cy.chooseWorkflow(3, "");
		cy.wait(500);
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.wait(1000); // Waiting for Workflow Details to get filled
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.selectSchedule(0);
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.wait(1000);
		cy.get("[data-cy=ControlButtons] Button").eq(0).click(); // Clicking on finish Button
		cy.get("[data-cy=FinishModal]").should("be.visible");
		cy.get("[data-cy=WorkflowName]").then(($name) => {
			workflowName = $name.text();
			return;
		});
		cy.get("[data-cy=GoToWorkflowButton]").click();
	});

	it("Download schedule manifest", () => {
		cy.visit("/workflows");
        cy.GraphqlWait("workflowListDetails", "listSchedules");
        cy.wait("@listSchedules").its("response.statusCode").should("eq", 200);
		cy.get("[data-cy=browseSchedule]").click();
		cy.downloadWorkflowManifest(workflowName);
	});

	it("Checking Workflow Browsing Table for scheduled workflow", () => {
		cy.GraphqlWait("workflowDetails", "listWorkflows");
		cy.visit("/workflows");
		cy.get("[data-cy=runs]").click();
		cy.wait("@listWorkflows").its("response.statusCode").should("eq", 200);
		cy.wait(1000);
		cy.get("[data-cy=WorkflowRunsTable] input").eq(0).clear().type(workflowName);
		cy.get("table")
			.find("tr")
			.eq(1)
			.then(($div) => {
				cy.wrap($div).find("td").eq(1).should("have.text", "Running"); // Matching Status
				cy.wrap($div)
					.find("td")
					.eq(2)
					.should("have.text", workflowName); // Matching Workflow Name Regex
				cy.wrap($div).find("td").eq(3).should("have.text", agent); // Matching Target Agent
				// cy.wrap($div).find("td [data-cy=browseWorkflowOptions]").click(); // Clicking on 3 Dots
				// cy.get("[data-cy=workflowDetails]").eq(0).click(); // Checking Workflow Graph And Other Details
			});
	});

	it("Saving the created workflow as a template", () => {
		cy.GraphqlWait("workflowListDetails", "listSchedules");
		cy.GraphqlWait("addWorkflowTemplate", "addTemplate");
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
				cy.wrap($div).find("td").eq(1).should("have.text", agent); // Matching Target Agent
			});
		cy.get("[data-cy=browseScheduleOptions]").eq(0).click({ scrollBehavior: false });
		cy.get("[data-cy=saveTemplate]")
			.eq(0)
			.should("have.text", "Save Template")
			.click({ force: true });
		cy.configureWorkflowSettings(
			"e2e-test-template",
			"e2e-test-template-description",
			0
		);
		cy.get("[data-cy=saveTemplateButton]").should("be.visible").click();
		cy.wait("@addTemplate").its("response.statusCode").should("eq", 200);
		cy.get("[data-cy=templateAlert]").should("be.visible");
		cy.wait(6000);
	});

	it("Creating a target application", () => {
		cy.createTargetApplication(targetAppNamespace, "target-app-1", "nginx");
	});

	it("Scheduling a new workflow from the saved template", () => {
		cy.visit("/create-workflow");
		cy.chooseAgent(agent);
		cy.get("[data-cy=ControlButtons] Button").eq(0).click();
		cy.chooseWorkflow(1, 0);
		cy.configureWorkflowSettings(
			"test-schedule-template",
			workflows.nonRecurringworkflowDescription,
			0
		);
		cy.get("[data-cy=WorkflowNamespace] input")
			.should("have.value", workflowNamespace);
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.wait(1000); // Needs to be removed with frontend enhancement
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.rScoreEditor(5);
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.selectSchedule(0);
		cy.get("[data-cy=ControlButtons] Button").eq(1).click();
		cy.verifyDetails(
			"test-schedule-template",
			workflows.nonRecurringworkflowDescription,
			0
		);
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

	it("Validating workflow existence and status on cluster", () => {
		// shouldExist = true
		cy.validateWorkflowExistence(workflowName, workflowNamespace, true);
		cy.validateWorkflowStatus(workflowName, workflowNamespace, ["Running"]);
	});

	it("Checking Workflow Browsing Table for scheduled workflow", () => {
		cy.GraphqlWait("workflowDetails", "listWorkflows");
		cy.visit("/workflows");
		cy.wait("@listWorkflows").its("response.statusCode").should("eq", 200);
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
				cy.wrap($div).find("td").eq(3).should("have.text", agent); // Matching Target Agent
				// cy.wrap($div).find("td [data-cy=browseWorkflowOptions]").click(); // Clicking on 3 Dots
				// cy.get("[data-cy=workflowDetails]").eq(0).click(); // Checking Workflow Graph And Other Details
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
		cy.validateWorkflowStatus(workflowName, workflowNamespace, ["Running", "Succeeded"]);
		cy.get("[data-cy=statsTabs]").find('button').eq(0).click();
		// Expected Nodes
		const graphNodesNameArray = [workflowName, "install-chaos-experiments", "pod-delete", "revert-chaos"];
		// Verify nodes in dagre graph (TODO: Check status of nodes)
		cy.validateGraphNodes(graphNodesNameArray);
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
				cy.wrap($div).find("td").eq(1).should("have.text", agent); // Matching Target Agent
			});
	});

	it("Validate Verdict, Resilience score and Experiments Passed", () => {
		cy.validateVerdict(workflowName, agent, "Succeeded", 100, 1, 1);
	});

	it("Deleting the target application", () => {
		cy.deleteTargetApplication(targetAppNamespace, "target-app-1");
	});

	it("Testing the workflow statistics", () => {
		cy.GraphqlWait("workflowListDetails", "recentRuns");
		cy.visit("/observability");
		cy.get("[data-cy=litmusDashboard]").click();
		cy.wait("@recentRuns").its("response.statusCode").should("eq", 200);
		cy.get(`[data-cy=${workflowName}]`)
			.find("[data-cy=statsButton]")
			.click();
		cy.validateWorkflowInfo(workflowName, workflowNamespace, workflowSubject, agent, "Cron workflow", "Cron workflow");
		cy.validateStatsChart();
		const experimentArray = [
			{
				experimentName: "pod-delete",
				verdict: "Pass",
				weightOfTest: 5,
				resultingPoints: 5
			}
		];
		cy.validateExperimentsTable(experimentArray);
	});
});
