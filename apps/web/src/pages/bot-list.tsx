import { PlusOutlined, RobotOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { Link } from "react-router-dom";
import "../lib/api";
import {
  deleteV1BotsByBotId,
  getV1Bots,
  postV1Bots,
} from "../../lib/api/sdk.gen";
import type { GetV1BotsResponse } from "../../lib/api/types.gen";

type Bot = GetV1BotsResponse["bots"][number];

export function BotListPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["bots"],
    queryFn: async () => {
      const { data } = await getV1Bots();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: {
      name: string;
      slug: string;
      systemPrompt?: string;
      modelId?: string;
    }) => {
      const { data, error } = await postV1Bots({ body: values });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      setCreateOpen(false);
      form.resetFields();
      message.success("Bot created");
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (botId: string) => {
      const { data, error } = await deleteV1BotsByBotId({
        path: { botId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      message.success("Bot deleted");
    },
  });

  const statusColor: Record<string, string> = {
    active: "green",
    paused: "orange",
    deleted: "red",
  };

  const columns: ColumnsType<Bot> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Bot) => (
        <Link to={`/bots/${record.id}`}>
          <Space>
            <RobotOutlined />
            {name}
          </Space>
        </Link>
      ),
    },
    {
      title: "Slug",
      dataIndex: "slug",
      key: "slug",
      render: (slug: string) => <code>{slug}</code>,
    },
    {
      title: "Model",
      dataIndex: "modelId",
      key: "modelId",
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
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (d: string) => new Date(d).toLocaleDateString(),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: Bot) => (
        <Button
          danger
          size="small"
          onClick={() => deleteMutation.mutate(record.id)}
        >
          Delete
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
        <Typography.Title level={3}>Bots</Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          Create Bot
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data?.bots ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title="Create Bot"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please enter bot name" }]}
          >
            <Input placeholder="My Bot" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[
              { required: true, message: "Please enter a slug" },
              {
                pattern: /^[a-z0-9-]+$/,
                message: "Lowercase letters, numbers and hyphens only",
              },
            ]}
          >
            <Input placeholder="my-bot" />
          </Form.Item>
          <Form.Item name="modelId" label="Model" initialValue="gpt-4o">
            <Input placeholder="gpt-4o" />
          </Form.Item>
          <Form.Item name="systemPrompt" label="System Prompt">
            <Input.TextArea
              rows={3}
              placeholder="You are a helpful assistant..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
