import {
  CaretRightOutlined,
  CodeOutlined,
  DisconnectOutlined,
  PauseOutlined,
  SlackOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../lib/api";
import {
  deleteV1BotsByBotIdChannelsByChannelId,
  getApiInternalPoolsByPoolIdConfig,
  getV1BotsByBotId,
  getV1BotsByBotIdChannels,
  postV1BotsByBotIdChannelsSlackConnect,
  postV1BotsByBotIdPause,
  postV1BotsByBotIdResume,
} from "../../lib/api/sdk.gen";
import type { GetV1BotsByBotIdChannelsResponse } from "../../lib/api/types.gen";

type Channel = GetV1BotsByBotIdChannelsResponse["channels"][number];

export function BotDetailPage() {
  const { botId = "" } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [slackModalOpen, setSlackModalOpen] = useState(false);
  const [configJson, setConfigJson] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [slackForm] = Form.useForm();

  const { data: bot, isLoading: botLoading } = useQuery({
    queryKey: ["bot", botId],
    queryFn: async () => {
      const { data, error } = await getV1BotsByBotId({ path: { botId } });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: botId.length > 0,
  });

  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ["channels", botId],
    queryFn: async () => {
      const { data, error } = await getV1BotsByBotIdChannels({
        path: { botId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: botId.length > 0,
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await postV1BotsByBotIdPause({
        path: { botId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] });
      message.success("Bot paused");
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await postV1BotsByBotIdResume({
        path: { botId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot", botId] });
      message.success("Bot resumed");
    },
  });

  const connectSlackMutation = useMutation({
    mutationFn: async (values: {
      botToken: string;
      signingSecret: string;
      teamId: string;
      teamName?: string;
    }) => {
      const { data, error } = await postV1BotsByBotIdChannelsSlackConnect({
        path: { botId },
        body: values,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", botId] });
      setSlackModalOpen(false);
      slackForm.resetFields();
      message.success("Slack connected");
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await deleteV1BotsByBotIdChannelsByChannelId({
        path: { botId, channelId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", botId] });
      message.success("Channel disconnected");
    },
  });

  const handlePreviewConfig = async () => {
    setConfigLoading(true);
    try {
      const { data, error } = await getApiInternalPoolsByPoolIdConfig({
        path: { poolId: "default" },
      });
      if (error) throw new Error(error.message);
      setConfigJson(JSON.stringify(data, null, 2));
    } catch {
      message.error("Failed to load config");
    } finally {
      setConfigLoading(false);
    }
  };

  if (botLoading) {
    return (
      <Spin size="large" style={{ display: "block", margin: "100px auto" }} />
    );
  }

  if (!bot) {
    navigate("/bots");
    return null;
  }

  const statusColor: Record<string, string> = {
    active: "green",
    paused: "orange",
    deleted: "red",
    connected: "green",
    disconnected: "red",
    pending: "blue",
    error: "red",
  };

  const channelColumns: ColumnsType<Channel> = [
    {
      title: "Type",
      dataIndex: "channelType",
      key: "channelType",
      render: (type: string) => (
        <Space>
          <SlackOutlined />
          {type}
        </Space>
      ),
    },
    {
      title: "Account ID",
      dataIndex: "accountId",
      key: "accountId",
      render: (id: string) => <code>{id}</code>,
    },
    {
      title: "Team",
      dataIndex: "teamName",
      key: "teamName",
      render: (name: string | null) => name ?? "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={statusColor[status] ?? "default"}>{status}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: Channel) => (
        <Button
          danger
          size="small"
          icon={<DisconnectOutlined />}
          onClick={() => disconnectMutation.mutate(record.id)}
        >
          Disconnect
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={3}>{bot.name}</Typography.Title>
        <Space>
          {bot.status === "active" ? (
            <Button
              icon={<PauseOutlined />}
              onClick={() => pauseMutation.mutate()}
            >
              Pause
            </Button>
          ) : (
            <Button
              icon={<CaretRightOutlined />}
              onClick={() => resumeMutation.mutate()}
            >
              Resume
            </Button>
          )}
          <Button
            icon={<CodeOutlined />}
            onClick={handlePreviewConfig}
            loading={configLoading}
          >
            Preview Config
          </Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="details"
        items={[
          {
            key: "details",
            label: "Details",
            children: (
              <Card>
                <Descriptions column={2} bordered>
                  <Descriptions.Item label="ID">
                    <code>{bot.id}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label="Slug">
                    <code>{bot.slug}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={statusColor[bot.status] ?? "default"}>
                      {bot.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Model">
                    {bot.modelId}
                  </Descriptions.Item>
                  <Descriptions.Item label="System Prompt" span={2}>
                    {bot.systemPrompt ?? <em>None</em>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Created">
                    {new Date(bot.createdAt).toLocaleString()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Updated">
                    {new Date(bot.updatedAt).toLocaleString()}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: "channels",
            label: "Channels",
            children: (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<SlackOutlined />}
                    onClick={() => setSlackModalOpen(true)}
                  >
                    Connect Slack
                  </Button>
                </div>
                <Table
                  columns={channelColumns}
                  dataSource={channelsData?.channels ?? []}
                  rowKey="id"
                  loading={channelsLoading}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: "config",
            label: "Config Preview",
            children: (
              <Card>
                <Button
                  type="primary"
                  icon={<CodeOutlined />}
                  onClick={handlePreviewConfig}
                  loading={configLoading}
                  style={{ marginBottom: 16 }}
                >
                  Load Config
                </Button>
                {configJson && (
                  <pre
                    style={{
                      background: "#f5f5f5",
                      padding: 16,
                      borderRadius: 8,
                      overflow: "auto",
                      maxHeight: 600,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {configJson}
                  </pre>
                )}
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Connect Slack"
        open={slackModalOpen}
        onCancel={() => setSlackModalOpen(false)}
        onOk={() => slackForm.submit()}
        confirmLoading={connectSlackMutation.isPending}
      >
        <Form
          form={slackForm}
          layout="vertical"
          onFinish={(values) => connectSlackMutation.mutate(values)}
        >
          <Form.Item
            name="teamId"
            label="Team ID"
            rules={[{ required: true, message: "Please enter Slack Team ID" }]}
          >
            <Input placeholder="T0123456789" />
          </Form.Item>
          <Form.Item name="teamName" label="Team Name">
            <Input placeholder="My Workspace" />
          </Form.Item>
          <Form.Item
            name="botToken"
            label="Bot Token"
            rules={[{ required: true, message: "Please enter Bot Token" }]}
          >
            <Input.Password placeholder="xoxb-..." />
          </Form.Item>
          <Form.Item
            name="signingSecret"
            label="Signing Secret"
            rules={[{ required: true, message: "Please enter Signing Secret" }]}
          >
            <Input.Password placeholder="Signing Secret" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
