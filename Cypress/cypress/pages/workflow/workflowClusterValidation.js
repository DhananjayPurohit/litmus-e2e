import { apis, KUBE_API_TOKEN } from "../../kube-apis/apis";

/// ************************** Validate workflow existence on cluster **********************

Cypress.Commands.add("validateWorkflowExistence", (workflowName, namespace) => {
    let workflowFound = false;
    cy.request({
        url: apis.getWorkflows(namespace),
        method: "GET",
        headers: {
            Authorization: `Bearer ${KUBE_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
    }).should((response) => {
        response.body.items.some((item) => {
            if (item.metadata.name === workflowName) {
                workflowFound = true;
                return true;
            }
        });
        if (workflowFound === false) {
            throw new Error("Workflow Not Found in cluster");
        }
    });
});

/// ************************** Validate workflow status on cluster **********************

Cypress.Commands.add("validateWorkflowStatus", (workflowName, namespace, expectedStatuses) => {
    cy.request({
        url: apis.getWorkflowByName(workflowName, namespace),
        method: "GET",
        headers: {
            Authorization: `Bearer ${KUBE_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
    }).should((response) => {
        expect(expectedStatuses.includes(response.body.status.phase)).to.be.true;
    });
});